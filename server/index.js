import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { parseString } from 'xml2js';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

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