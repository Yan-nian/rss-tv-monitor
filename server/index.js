const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parseString } = require('xml2js');
const path = require('path');

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

module.exports = app;