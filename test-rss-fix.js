// 测试RSS数据更新修复的脚本
import axios from 'axios';

// 测试RSS抓取和数据处理
async function testRSSFix() {
  console.log('🧪 开始测试RSS数据更新修复...');
  
  try {
    // 1. 测试后端RSS抓取
    console.log('\n📡 测试后端RSS抓取...');
    const rssUrl = 'https://hhanclub.top/torrentrss.php?passkey=e5b934b61699f1748170096eda9d403a&rows=30&sou2=1&ismalldescr=1';
    
    const response = await axios.post('http://localhost:3001/api/rss/fetch', {
      url: rssUrl
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.data && response.data.success) {
      const itemCount = response.data.data?.items?.length || 0;
      console.log(`✅ RSS抓取成功，获取到 ${itemCount} 个条目`);
      
      // 显示前几个条目的标题
      if (response.data.data?.items?.length > 0) {
        console.log('\n📋 前5个RSS条目:');
        response.data.data.items.slice(0, 5).forEach((item, index) => {
          console.log(`${index + 1}. ${item.title}`);
        });
      }
      
      // 2. 测试剧名提取
      console.log('\n🎬 测试剧名提取...');
      const sampleItems = response.data.data.items.slice(0, 3);
      
      for (const item of sampleItems) {
        console.log(`\n原标题: ${item.title}`);
        
        // 模拟剧名提取逻辑
        const extractedTitle = extractTVShowTitle(item.title);
        if (extractedTitle) {
          console.log(`✅ 提取到剧名: ${extractedTitle}`);
        } else {
          console.log(`❌ 未能提取剧名`);
        }
      }
      
    } else {
      console.log('❌ RSS抓取失败:', response.data);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 简化的剧名提取函数（模拟前端逻辑）
function extractTVShowTitle(title) {
  if (!title) return null;
  
  // 清理标题，移除方括号内容
  let cleanTitle = title.trim();
  cleanTitle = cleanTitle.replace(/\[.*?\].*$/, '').trim();
  
  // 针对青蛙PT站格式优化的剧名提取
  const patterns = [
    // 匹配 "剧名 S01E04" 格式
    /^(.+?)\s+S\d+E\d+/i,
    // 匹配 "剧名 S01" 格式
    /^(.+?)\s+S\d+/i,
    // 匹配包含年份的格式 "剧名 2025"
    /^(.+?)\s+\d{4}/,
    // 匹配包含分辨率的格式 "剧名 1080p"
    /^(.+?)\s+\d{3,4}p/i,
    // 匹配包含编码信息的格式
    /^(.+?)\s+(?:WEB|BluRay|BDRip|DVDRip|HDTV|CR)/i,
  ];
  
  // 先尝试特定格式
  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      if (extracted.length > 2) {
        return extracted;
      }
    }
  }
  
  return null;
}

// 运行测试
testRSSFix();