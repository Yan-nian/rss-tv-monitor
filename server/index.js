import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { parseString } from 'xml2js';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;

// 存储RSS源和自动刷新配置的内存数据
let rssSourcesData = [];
let autoRefreshEnabled = true;
let refreshTimers = new Map();

// 数据持久化文件路径
const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : './data';
const DATA_FILE = path.join(dataDir, 'rss-data.json');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 加载持久化数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      rssSourcesData = data.rssSources || [];
      autoRefreshEnabled = data.autoRefreshEnabled !== false;
      console.log('已加载持久化数据:', { sources: rssSourcesData.length, autoRefresh: autoRefreshEnabled });
    }
  } catch (error) {
    console.error('加载数据失败:', error.message);
  }
}

// 保存数据到文件
function saveData() {
  try {
    const data = {
      rssSources: rssSourcesData,
      autoRefreshEnabled,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('保存数据失败:', error.message);
  }
}

// 自动刷新RSS源的函数
async function refreshRSSSource(source) {
  try {
    console.log(`开始自动刷新RSS源: ${source.name}`);
    
    const response = await axios.get(source.url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (response.data && typeof response.data === 'string') {
      const parsedData = await parseXML(response.data);
      console.log(`RSS源 ${source.name} 自动刷新成功，包含 ${parsedData.items?.length || 0} 个条目`);
      
      // 更新源的最后更新时间
      const sourceIndex = rssSourcesData.findIndex(s => s.id === source.id);
      if (sourceIndex !== -1) {
        rssSourcesData[sourceIndex].lastUpdate = new Date().toISOString();
        rssSourcesData[sourceIndex].status = 'active';
        saveData();
      }
      
      return parsedData;
    }
  } catch (error) {
    console.error(`RSS源 ${source.name} 自动刷新失败:`, error.message);
    
    // 更新源状态为错误
    const sourceIndex = rssSourcesData.findIndex(s => s.id === source.id);
    if (sourceIndex !== -1) {
      rssSourcesData[sourceIndex].status = 'error';
      saveData();
    }
  }
}

// 启动单个RSS源的定时器
function startRSSTimer(source) {
  if (!autoRefreshEnabled || !source.updateInterval) return;
  
  // 清除现有定时器
  if (refreshTimers.has(source.id)) {
    clearInterval(refreshTimers.get(source.id));
  }
  
  // 设置新定时器
  const intervalMs = source.updateInterval * 60 * 1000; // 转换为毫秒
  const timer = setInterval(() => {
    refreshRSSSource(source);
  }, intervalMs);
  
  refreshTimers.set(source.id, timer);
  console.log(`已启动RSS源 ${source.name} 的定时器，间隔 ${source.updateInterval} 分钟`);
}

// 停止单个RSS源的定时器
function stopRSSTimer(sourceId) {
  if (refreshTimers.has(sourceId)) {
    clearInterval(refreshTimers.get(sourceId));
    refreshTimers.delete(sourceId);
    console.log(`已停止RSS源 ${sourceId} 的定时器`);
  }
}

// 启动所有RSS源的定时器
function startAllRSSTimers() {
  if (!autoRefreshEnabled) {
    console.log('自动刷新已禁用，跳过启动定时器');
    return;
  }
  
  console.log(`启动所有RSS源定时器，共 ${rssSourcesData.length} 个源`);
  rssSourcesData.forEach(source => {
    if (source.updateInterval > 0) {
      startRSSTimer(source);
    }
  });
}

// 停止所有定时器
function stopAllRSSTimers() {
  refreshTimers.forEach((timer, sourceId) => {
    clearInterval(timer);
  });
  refreshTimers.clear();
  console.log('已停止所有RSS定时器');
}

// 初始化时加载数据并启动定时器
loadData();
setTimeout(() => {
  startAllRSSTimers();
}, 5000); // 延迟5秒启动，确保服务完全启动

// 中间件
app.use(cors());
app.use(express.json());

// RSS获取API
app.post('/api/rss/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'RSS URL is required' });
    }

    console.log('Fetching RSS from:', url);
    
    // 直接请求RSS源，不需要CORS代理
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    // 验证响应是否包含XML内容
    if (!response.data || typeof response.data !== 'string') {
      throw new Error('Invalid RSS response format');
    }

    // 解析XML
    const parsedData = await parseXML(response.data);
    
    console.log('RSS parsed successfully, items count:', parsedData.items?.length || 0);
    
    res.json({
      success: true,
      data: parsedData
    });
    
  } catch (error) {
    console.error('RSS fetch error:', error.message);
    
    let errorMessage = '无法获取RSS源内容';
    
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'RSS源地址无法访问，请检查URL是否正确';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'RSS源服务器拒绝连接';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'RSS源请求超时，请稍后重试';
    } else if (error.response?.status === 404) {
      errorMessage = 'RSS源不存在（404错误）';
    } else if (error.response?.status === 403) {
      errorMessage = 'RSS源访问被拒绝（403错误），可能需要特殊权限';
    } else if (error.message.includes('Invalid RSS response')) {
      errorMessage = 'RSS源返回的内容格式无效';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

// RSS测试连接API
app.post('/api/rss/test', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'RSS URL is required' });
    }

    console.log('Testing RSS connection:', url);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    // 简单验证是否是有效的XML
    if (response.data && typeof response.data === 'string' && 
        (response.data.includes('<rss') || response.data.includes('<feed'))) {
      res.json({ success: true, message: 'RSS源连接成功' });
    } else {
      res.json({ success: false, message: 'RSS源格式无效' });
    }
    
  } catch (error) {
    console.error('RSS test error:', error.message);
    res.json({ success: false, message: '连接失败: ' + error.message });
  }
});

// 解析XML的辅助函数
function parseXML(xmlContent) {
  return new Promise((resolve, reject) => {
    parseString(xmlContent, { trim: true }, (err, result) => {
      if (err) {
        reject(new Error('RSS内容解析失败: ' + err.message));
        return;
      }
      
      try {
        const channel = result.rss?.channel?.[0] || result.feed;
        const items = channel.item || channel.entry || [];
        
        const feed = {
          title: extractText(channel.title),
          description: extractText(channel.description),
          items: items.map((item) => ({
            title: extractText(item.title),
            link: extractText(item.link),
            description: extractText(item.description),
            pubDate: extractText(item.pubDate || item.published),
            guid: extractText(item.guid || item.id),
          })),
        };
        
        resolve(feed);
      } catch (parseError) {
        reject(new Error('RSS数据结构解析失败: ' + parseError.message));
      }
    });
  });
}

// 提取文本的辅助函数
function extractText(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    const item = field[0];
    if (typeof item === 'string') return item;
    if (item && item._) return item._;
    if (item && item.$t) return item.$t;
  }
  return String(field);
}

// Discord通知API
app.post('/api/notifications/discord/test', async (req, res) => {
  try {
    const { botToken, channelId } = req.body;
    
    if (!botToken || !channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bot Token和Channel ID不能为空' 
      });
    }

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    
    const response = await axios.post(url, {
      content: '🧪 RSS监控工具测试消息',
    }, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    res.json({ success: true, message: 'Discord测试消息发送成功' });
    
  } catch (error) {
    console.error('Discord test error:', error.response?.data || error.message);
    
    let errorMessage = 'Discord连接失败';
    
    if (error.response?.status === 401) {
      errorMessage = 'Bot Token无效，请检查是否正确';
    } else if (error.response?.status === 403) {
      errorMessage = 'Bot没有发送消息的权限，请检查Bot权限设置';
    } else if (error.response?.status === 404) {
      errorMessage = 'Channel ID不存在或Bot无法访问该频道';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到Discord API，请检查网络连接';
    }
    
    res.json({ 
      success: false, 
      error: errorMessage,
      details: error.response?.data?.message || error.message
    });
  }
});

// RSS源管理API
app.get('/api/rss/sources', (req, res) => {
  res.json({
    success: true,
    data: rssSourcesData
  });
});

app.post('/api/rss/sources', (req, res) => {
  try {
    const { name, url, updateInterval = 30 } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'RSS源名称和URL不能为空' });
    }

    const newSource = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name,
      url,
      updateInterval,
      status: 'active',
      lastUpdate: new Date().toISOString()
    };

    rssSourcesData.push(newSource);
    saveData();
    
    // 启动新源的定时器
    if (autoRefreshEnabled) {
      startRSSTimer(newSource);
    }

    res.json({
      success: true,
      data: newSource
    });
  } catch (error) {
    console.error('添加RSS源失败:', error.message);
    res.status(500).json({ error: '添加RSS源失败' });
  }
});

app.put('/api/rss/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const sourceIndex = rssSourcesData.findIndex(s => s.id === id);
    if (sourceIndex === -1) {
      return res.status(404).json({ error: 'RSS源不存在' });
    }

    // 更新源信息
    rssSourcesData[sourceIndex] = { ...rssSourcesData[sourceIndex], ...updates };
    saveData();
    
    // 如果更新了刷新间隔，重启定时器
    if (updates.updateInterval !== undefined) {
      stopRSSTimer(id);
      if (autoRefreshEnabled) {
        startRSSTimer(rssSourcesData[sourceIndex]);
      }
    }

    res.json({
      success: true,
      data: rssSourcesData[sourceIndex]
    });
  } catch (error) {
    console.error('更新RSS源失败:', error.message);
    res.status(500).json({ error: '更新RSS源失败' });
  }
});

app.delete('/api/rss/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const sourceIndex = rssSourcesData.findIndex(s => s.id === id);
    if (sourceIndex === -1) {
      return res.status(404).json({ error: 'RSS源不存在' });
    }

    // 停止定时器
    stopRSSTimer(id);
    
    // 删除源
    rssSourcesData.splice(sourceIndex, 1);
    saveData();

    res.json({ success: true });
  } catch (error) {
    console.error('删除RSS源失败:', error.message);
    res.status(500).json({ error: '删除RSS源失败' });
  }
});

// 自动刷新控制API
app.get('/api/rss/auto-refresh', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: autoRefreshEnabled,
      activeTimers: refreshTimers.size,
      totalSources: rssSourcesData.length
    }
  });
});

app.post('/api/rss/auto-refresh', (req, res) => {
  try {
    const { enabled } = req.body;
    
    autoRefreshEnabled = enabled;
    saveData();
    
    if (enabled) {
      startAllRSSTimers();
    } else {
      stopAllRSSTimers();
    }

    res.json({
      success: true,
      data: {
        enabled: autoRefreshEnabled,
        activeTimers: refreshTimers.size
      }
    });
  } catch (error) {
    console.error('切换自动刷新失败:', error.message);
    res.status(500).json({ error: '切换自动刷新失败' });
  }
});

// 手动刷新单个RSS源
app.post('/api/rss/refresh/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const source = rssSourcesData.find(s => s.id === id);
    if (!source) {
      return res.status(404).json({ error: 'RSS源不存在' });
    }

    const result = await refreshRSSSource(source);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('手动刷新RSS源失败:', error.message);
    res.status(500).json({ error: '手动刷新失败' });
  }
});

// 手动刷新所有RSS源
app.post('/api/rss/refresh-all', async (req, res) => {
  try {
    const results = [];
    
    for (const source of rssSourcesData) {
      try {
        const result = await refreshRSSSource(source);
        results.push({ sourceId: source.id, success: true, data: result });
      } catch (error) {
        results.push({ sourceId: source.id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('批量刷新RSS源失败:', error.message);
    res.status(500).json({ error: '批量刷新失败' });
  }
});

// Telegram通知API
app.post('/api/notifications/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    
    if (!botToken || !chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bot Token和Chat ID不能为空' 
      });
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await axios.post(url, {
      chat_id: chatId,
      text: '🧪 RSS监控工具测试消息',
      parse_mode: 'HTML',
    });

    res.json({ success: true, message: 'Telegram测试消息发送成功' });
    
  } catch (error) {
    console.error('Telegram test error:', error.response?.data || error.message);
    
    let errorMessage = 'Telegram连接失败';
    
    if (error.response?.status === 401) {
      errorMessage = 'Bot Token无效，请检查是否正确';
    } else if (error.response?.status === 400) {
      errorMessage = 'Chat ID无效或Bot无法访问该聊天';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到Telegram API，请检查网络连接';
    }
    
    res.json({ 
      success: false, 
      error: errorMessage,
      details: error.response?.data?.description || error.message
    });
  }
});

// Telegram发送通知API
app.post('/api/notifications/telegram/send', async (req, res) => {
  try {
    const { botToken, chatId, message } = req.body;
    
    if (!botToken || !chatId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: '参数不完整' 
      });
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    });

    res.json({ success: true });
    
  } catch (error) {
    console.error('Telegram send error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.description || error.message
    });
  }
});

// Discord发送通知API
app.post('/api/notifications/discord/send', async (req, res) => {
  try {
    const { botToken, channelId, message } = req.body;
    
    if (!botToken || !channelId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: '参数不完整' 
      });
    }

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    
    await axios.post(url, {
      content: message,
    }, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    res.json({ success: true });
    
  } catch (error) {
    console.error('Discord send error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 开发环境下不需要处理前端路由，前端由Vite服务
// 生产环境下可以取消注释以下代码
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../dist/index.html'));
// });

app.listen(PORT, () => {
  console.log(`🚀 RSS监控工具后端服务启动成功！`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API地址: http://localhost:${PORT}/api`);
});

export default app;