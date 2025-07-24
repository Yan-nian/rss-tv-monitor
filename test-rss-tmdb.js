// 测试RSS中TMDB自动搜索功能
const axios = require('axios');

// 模拟RSS条目
const mockRSSItems = [
  {
    title: '[青蛙PT] The Bear S03E01 1080p WEB-DL H.264',
    description: '◎片名 The Bear\n◎译名 熊家餐厅\n◎年代 2022\n◎类型 剧情/喜剧',
    link: 'magnet:?xt=urn:btih:test1',
    pubDate: new Date().toISOString()
  },
  {
    title: '[青蛙PT] Wednesday S01E08 1080p WEB-DL H.264',
    description: '◎片名 Wednesday\n◎译名 星期三\n◎年代 2022\n◎类型 剧情/恐怖/喜剧',
    link: 'magnet:?xt=urn:btih:test2',
    pubDate: new Date().toISOString()
  },
  {
    title: '[青蛙PT] House of the Dragon S02E04 1080p WEB-DL H.264',
    description: '◎片名 House of the Dragon\n◎译名 龙之家族\n◎年代 2022\n◎类型 剧情/奇幻',
    link: 'magnet:?xt=urn:btih:test3',
    pubDate: new Date().toISOString()
  }
];

// 模拟标题提取函数
function extractTVShowTitle(title) {
  console.log(`正在提取剧名: "${title}"`);
  
  // 清理标题，移除方括号内容
  let cleanTitle = title.trim();
  cleanTitle = cleanTitle.replace(/\[.*?\].*$/, '').trim();
  
  console.log(`清理后的标题: "${cleanTitle}"`);
  
  // 针对青蛙PT站格式优化的剧名提取
  const qingwaPatterns = [
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
    // 匹配包含H.264等编码的格式
    /^(.+?)\s+H\.\d+/i,
  ];
  
  // 先尝试青蛙PT站特定格式
  for (let i = 0; i < qingwaPatterns.length; i++) {
    const pattern = qingwaPatterns[i];
    const match = cleanTitle.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // 移除末尾的特殊字符
      extracted = extracted.replace(/[\-_\s]+$/, '');
      
      if (extracted.length > 2) {
        console.log(`青蛙PT格式匹配成功: "${extracted}"`);
        return extracted;
      }
    }
  }
  
  return null;
}

// 模拟中文标题提取函数
function extractChineseTitle(title, description) {
  if (!description) return null;
  
  console.log(`正在从description中提取中文片名: "${description.substring(0, 100)}..."`);
  
  // 匹配description中的片名模式
  const descriptionPatterns = [
    // 匹配 ◎译名
    /◎译[\s　]*名[\s　]*([^\n\r]+)/gi,
    // 匹配 ◎片名 或 ◎原名
    /◎片[\s　]*名[\s　]*([^\n\r]+)/gi,
    /◎原[\s　]*名[\s　]*([^\n\r]+)/gi,
  ];
  
  for (const pattern of descriptionPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // 清理可能的多余信息
      extracted = extracted.replace(/\s*\([^)]*\)\s*$/, ''); // 移除末尾括号内容
      extracted = extracted.replace(/\s*\[[^\]]*\]\s*$/, ''); // 移除末尾方括号内容
      extracted = extracted.replace(/\s*[\-_]+\s*$/, ''); // 移除末尾的连字符
      
      if (extracted.length > 2 && !extracted.includes('◎') && !extracted.includes('：')) {
        console.log(`从description中成功提取中文片名: "${extracted}"`);
        return extracted;
      }
    }
  }
  
  return null;
}

// 模拟TMDB搜索
async function testTMDBSearch(title, chineseTitle, apiKey) {
  if (!apiKey) {
    console.log('❌ 缺少TMDB API Key');
    return null;
  }
  
  try {
    console.log(`\n🎯 开始TMDB搜索: "${title}"${chineseTitle ? ` / "${chineseTitle}"` : ''}`);
    
    const queries = [];
    if (chineseTitle && chineseTitle.trim()) {
      queries.push(chineseTitle.trim());
    }
    if (title && title.trim()) {
      queries.push(title.trim());
    }
    
    for (const query of queries) {
      console.log(`🔍 搜索查询: "${query}"`);
      
      const response = await axios.get('https://api.themoviedb.org/3/search/multi', {
        params: {
          api_key: apiKey,
          language: 'zh-CN',
          query: query.trim(),
          include_adult: false,
          page: 1
        },
        timeout: 15000
      });
      
      const results = response.data.results || [];
      console.log(`   找到 ${results.length} 个结果`);
      
      if (results.length > 0) {
        // 优先选择电视剧
        const tvResult = results.find(r => r.media_type === 'tv');
        if (tvResult) {
          const tmdbUrl = `https://www.themoviedb.org/tv/${tvResult.id}`;
          console.log(`✅ 找到TMDB电视剧链接: ${tmdbUrl}`);
          console.log(`   标题: ${tvResult.name || tvResult.title}`);
          console.log(`   年份: ${tvResult.first_air_date ? new Date(tvResult.first_air_date).getFullYear() : '未知'}`);
          return tmdbUrl;
        }
        
        // 如果没有电视剧，选择电影
        const movieResult = results.find(r => r.media_type === 'movie');
        if (movieResult) {
          const tmdbUrl = `https://www.themoviedb.org/movie/${movieResult.id}`;
          console.log(`✅ 找到TMDB电影链接: ${tmdbUrl}`);
          console.log(`   标题: ${movieResult.title || movieResult.name}`);
          console.log(`   年份: ${movieResult.release_date ? new Date(movieResult.release_date).getFullYear() : '未知'}`);
          return tmdbUrl;
        }
      }
      
      // 避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('❌ 未找到匹配的TMDB链接');
    return null;
  } catch (error) {
    console.log('❌ TMDB搜索失败:', error.response?.status, error.message);
    return null;
  }
}

// 主测试函数
async function testRSSWithTMDB() {
  console.log('=== RSS TMDB自动搜索功能测试 ===\n');
  
  const apiKey = process.env.TMDB_API_KEY || '';
  
  if (!apiKey) {
    console.log('❌ 请设置TMDB_API_KEY环境变量');
    console.log('   export TMDB_API_KEY="your_api_key_here"');
    return;
  }
  
  console.log('✅ TMDB API Key已配置\n');
  
  for (const item of mockRSSItems) {
    console.log(`\n📺 处理RSS条目: ${item.title}`);
    console.log(`   描述: ${item.description.substring(0, 50)}...`);
    
    // 提取标题
    const extractedTitle = extractTVShowTitle(item.title);
    if (!extractedTitle) {
      console.log('❌ 无法提取剧名，跳过');
      continue;
    }
    
    // 提取中文标题
    const chineseTitle = extractChineseTitle(item.title, item.description);
    
    console.log(`   提取的英文标题: "${extractedTitle}"`);
    console.log(`   提取的中文标题: "${chineseTitle || '无'}"`);
    
    // 模拟检查是否已有TMDB链接（这里假设没有）
    console.log('   RSS中无TMDB链接，开始自动搜索...');
    
    // 执行TMDB搜索
    const tmdbLink = await testTMDBSearch(extractedTitle, chineseTitle, apiKey);
    
    if (tmdbLink) {
      console.log(`✅ 成功为 "${extractedTitle}" 找到TMDB链接: ${tmdbLink}`);
    } else {
      console.log(`❌ 未能为 "${extractedTitle}" 找到TMDB链接`);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
if (require.main === module) {
  testRSSWithTMDB().catch(console.error);
}

module.exports = { testRSSWithTMDB };