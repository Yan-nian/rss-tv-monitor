// TMDB自动搜索功能测试脚本
const axios = require('axios');

// 模拟TMDB服务配置
class TMDBTestService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.config = {
      apiKey: '', // 需要从设置中获取
      enabled: false
    };
  }

  setConfig(config) {
    this.config = config;
    console.log('TMDB配置已设置:', { enabled: config.enabled, hasApiKey: !!config.apiKey });
  }

  async testConnection() {
    if (!this.config.enabled || !this.config.apiKey) {
      console.log('❌ TMDB未启用或缺少API Key');
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/configuration`, {
        params: {
          api_key: this.config.apiKey
        },
        timeout: 10000
      });
      console.log('✅ TMDB连接测试成功');
      return true;
    } catch (error) {
      console.log('❌ TMDB连接测试失败:', error.response?.status, error.response?.statusText);
      return false;
    }
  }

  async searchMulti(query) {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('TMDB API未配置或未启用');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search/multi`, {
        params: {
          api_key: this.config.apiKey,
          language: 'zh-CN',
          query: query.trim(),
          include_adult: false,
          page: 1
        },
        timeout: 15000
      });
      
      const results = response.data.results || [];
      console.log(`🔍 搜索"${query}"找到 ${results.length} 个结果`);
      
      if (results.length > 0) {
        results.slice(0, 3).forEach((result, index) => {
          const title = result.title || result.name || '未知标题';
          const type = result.media_type;
          const year = result.release_date || result.first_air_date;
          const tmdbUrl = `https://www.themoviedb.org/${type}/${result.id}`;
          console.log(`  ${index + 1}. ${title} (${type}) ${year ? new Date(year).getFullYear() : ''} - ${tmdbUrl}`);
        });
      }
      
      return results;
    } catch (error) {
      console.log(`❌ 搜索"${query}"失败:`, error.response?.status, error.message);
      return [];
    }
  }

  async smartSearch(title, chineseTitle) {
    console.log(`\n🎯 开始智能搜索: "${title}"${chineseTitle ? ` / "${chineseTitle}"` : ''}`);
    
    const queries = [];
    if (chineseTitle && chineseTitle.trim()) {
      queries.push(chineseTitle.trim());
    }
    if (title && title.trim()) {
      queries.push(title.trim());
    }
    
    for (const query of queries) {
      const results = await this.searchMulti(query);
      if (results.length > 0) {
        // 优先选择电视剧
        const tvResult = results.find(r => r.media_type === 'tv');
        if (tvResult) {
          const tmdbUrl = `https://www.themoviedb.org/tv/${tvResult.id}`;
          console.log(`✅ 找到TMDB链接: ${tmdbUrl}`);
          return tmdbUrl;
        }
        
        // 如果没有电视剧，选择电影
        const movieResult = results.find(r => r.media_type === 'movie');
        if (movieResult) {
          const tmdbUrl = `https://www.themoviedb.org/movie/${movieResult.id}`;
          console.log(`✅ 找到TMDB链接: ${tmdbUrl}`);
          return tmdbUrl;
        }
      }
    }
    
    console.log('❌ 未找到匹配的TMDB链接');
    return null;
  }
}

// 测试函数
async function testTMDBFunction() {
  console.log('=== TMDB自动搜索功能测试 ===\n');
  
  const tmdbService = new TMDBTestService();
  
  // 从环境变量或手动设置API Key
  const apiKey = process.env.TMDB_API_KEY || '';
  
  if (!apiKey) {
    console.log('❌ 请设置TMDB_API_KEY环境变量或在代码中手动设置API Key');
    console.log('   export TMDB_API_KEY="your_api_key_here"');
    return;
  }
  
  tmdbService.setConfig({
    apiKey: apiKey,
    enabled: true
  });
  
  // 测试连接
  const connectionOk = await tmdbService.testConnection();
  if (!connectionOk) {
    return;
  }
  
  // 测试搜索
  const testCases = [
    { title: 'The Bear', chineseTitle: '熊家餐厅' },
    { title: 'Wednesday', chineseTitle: '星期三' },
    { title: 'House of the Dragon', chineseTitle: '龙之家族' },
    { title: 'Stranger Things', chineseTitle: '怪奇物语' },
    { title: 'The Last of Us', chineseTitle: '最后生还者' }
  ];
  
  for (const testCase of testCases) {
    await tmdbService.smartSearch(testCase.title, testCase.chineseTitle);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 避免API限制
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
if (require.main === module) {
  testTMDBFunction().catch(console.error);
}

module.exports = { TMDBTestService };