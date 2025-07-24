import axios from 'axios';

export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
  vote_average: number;
}

export interface TMDBConfig {
  apiKey: string;
  enabled: boolean;
  proxy?: {
    enabled: boolean;
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
  };
}

class TMDBService {
  private baseUrl = 'https://api.themoviedb.org/3';
  private config: TMDBConfig = {
    apiKey: '',
    enabled: false
  };
  
  // 缓存机制，减少重复请求
  private searchCache = new Map<string, { result: string | null; timestamp: number }>();
  private cacheExpireTime = 24 * 60 * 60 * 1000; // 24小时缓存
  
  // 请求限制，避免过于频繁的API调用
  private lastRequestTime = 0;
  private minRequestInterval = 2000; // 最小请求间隔2秒，减少API压力

  setConfig(config: TMDBConfig) {
    this.config = config;
  }

  getConfig(): TMDBConfig {
    return this.config;
  }

  /**
   * 等待请求间隔，避免过于频繁的API调用
   */
  private async waitForRequestInterval(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`等待 ${waitTime}ms 以避免过于频繁的API请求`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  /**
   * 检查缓存中是否有有效的搜索结果
   */
  private getCachedResult(cacheKey: string): string | null | undefined {
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.cacheExpireTime;
      if (!isExpired) {
        console.log(`使用缓存结果: ${cacheKey}`);
        return cached.result;
      } else {
        // 清除过期缓存
        this.searchCache.delete(cacheKey);
      }
    }
    return undefined;
  }
  
  /**
   * 缓存搜索结果
   */
  private setCachedResult(cacheKey: string, result: string | null): void {
    this.searchCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // 限制缓存大小，避免内存泄漏
    if (this.searchCache.size > 1000) {
      const oldestKey = this.searchCache.keys().next().value;
      this.searchCache.delete(oldestKey);
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}, retries: number = 0) {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('TMDB API未配置或未启用');
    }

    // 等待请求间隔
    await this.waitForRequestInterval();

    // 构建axios配置
    const axiosConfig: any = {
      params: {
        api_key: this.config.apiKey,
        language: 'zh-CN',
        ...params
      },
      timeout: 10000 // 增加超时时间到10秒
    };

    // 如果启用了代理，添加代理配置
    if (this.config.proxy?.enabled && this.config.proxy.host) {
      const proxyConfig: any = {
        host: this.config.proxy.host,
        port: this.config.proxy.port,
        protocol: this.config.proxy.protocol || 'http'
      };

      // 如果有认证信息，添加认证
      if (this.config.proxy.username && this.config.proxy.password) {
        proxyConfig.auth = {
          username: this.config.proxy.username,
          password: this.config.proxy.password
        };
      }

      axiosConfig.proxy = proxyConfig;
      console.log(`使用代理: ${this.config.proxy.protocol}://${this.config.proxy.host}:${this.config.proxy.port}`);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, axiosConfig);
        return response.data;
      } catch (error) {
        if (attempt === retries) {
          console.error(`TMDB API请求失败 (${attempt + 1}/${retries + 1}):`, error);
          throw new Error('TMDB API请求失败');
        }
        
        // 等待一段时间后重试
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(`TMDB API请求失败，${delay}ms后重试 (${attempt + 1}/${retries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async searchMulti(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/multi', {
        query: query.trim(),
        include_adult: false,
        page: 1
      });
      
      const results = data.results || [];
      
      // 只使用第一页结果，减少API调用
      return results.slice(0, 10); // 限制结果数量
    } catch (error) {
      console.error('TMDB搜索失败:', error);
      return [];
    }
  }

  async searchTV(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/tv', {
        query: query.trim(),
        include_adult: false,
        page: 1
      });
      
      const results = data.results?.map((item: any) => ({
        ...item,
        media_type: 'tv' as const
      })) || [];
      
      // 只使用第一页结果，减少API调用
      
      return results;
    } catch (error) {
      console.error('TMDB电视剧搜索失败:', error);
      return [];
    }
  }

  async searchMovie(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/movie', {
        query: query.trim(),
        include_adult: false,
        page: 1
      });
      
      const results = data.results?.map((item: any) => ({
        ...item,
        media_type: 'movie' as const
      })) || [];
      
      // 只使用第一页结果，减少API调用
      
      return results;
    } catch (error) {
      console.error('TMDB电影搜索失败:', error);
      return [];
    }
  }

  /**
   * 预处理搜索查询，清理和标准化标题（优化版，减少查询变体）
   */
  private preprocessQuery(query: string): string[] {
    if (!query) return [];
    
    const variants = [];
    let cleanQuery = query.trim();
    
    // 移除常见的无关信息（更激进的清理）
    cleanQuery = cleanQuery.replace(/\b(S\d+E?\d*|Season\s+\d+|第\d+季|全\d+集)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(\d{4}|\d{3,4}p|HD|4K|BluRay|WEB|HDTV|DVDRip)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(H\.?264|H\.?265|x264|x265|HEVC|AVC)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(REMUX|BDRip|WEBRip|HDRip|CAMRip)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(更新|完结|连载|全集)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\[.*?\]/g, ''); // 移除方括号内容
    cleanQuery = cleanQuery.replace(/\(.*?\)/g, ''); // 移除圆括号内容
    cleanQuery = cleanQuery.replace(/[\-_]+/g, ' '); // 替换连字符和下划线为空格
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim(); // 合并多个空格
    
    if (cleanQuery && cleanQuery.length > 2) {
      variants.push(cleanQuery);
      
      // 只处理最明显的分隔符，取主标题
      const subtitleSeparators = [' - ', ' – ', ' — ', ' | ', ' / ', ':'];
      for (const sep of subtitleSeparators) {
        if (cleanQuery.includes(sep)) {
          const parts = cleanQuery.split(sep);
          const mainTitle = parts[0].trim();
          if (mainTitle && mainTitle !== cleanQuery && mainTitle.length > 2) {
            variants.push(mainTitle);
            break; // 只取第一个有效的主标题
          }
        }
      }
    }
    
    // 去重并只返回最佳的1个变体以减少API调用
    const uniqueVariants = [...new Set(variants)]
      .filter(v => v.length > 2)
      .sort((a, b) => b.length - a.length); // 按长度排序，较长的通常更精确
    
    return uniqueVariants.slice(0, 1); // 只返回1个最佳变体
  }

  /**
   * 计算搜索结果的相关性分数
   */
  private calculateRelevanceScore(result: TMDBSearchResult, originalQuery: string): number {
    const title = (result.title || result.name || '').toLowerCase();
    const query = originalQuery.toLowerCase();
    
    let score = 0;
    
    // 完全匹配得分最高
    if (title === query) {
      score += 100;
    }
    // 包含查询词
    else if (title.includes(query)) {
      score += 80;
    }
    // 查询词包含在标题中
    else if (query.includes(title)) {
      score += 60;
    }
    // 部分匹配
    else {
      const queryWords = query.split(' ').filter(word => word.length > 1);
      const titleWords = title.split(' ').filter(word => word.length > 1);
      
      let matchingWords = 0;
      let exactMatches = 0;
      
      for (const queryWord of queryWords) {
        for (const titleWord of titleWords) {
          if (queryWord === titleWord) {
            exactMatches++;
            matchingWords++;
            break;
          } else if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
            matchingWords++;
            break;
          }
        }
      }
      
      // 精确匹配词汇的权重更高
      score += (exactMatches / queryWords.length) * 50;
      score += (matchingWords / queryWords.length) * 30;
      
      // 如果大部分关键词都匹配，额外加分
      if (matchingWords / queryWords.length > 0.7) {
        score += 20;
      }
    }
    
    // 字符串相似度计算（简单的编辑距离）
    const similarity = this.calculateStringSimilarity(title, query);
    score += similarity * 15;
    
    // 评分加成
    if (result.vote_average > 8) score += 15;
    else if (result.vote_average > 7) score += 10;
    else if (result.vote_average > 5) score += 5;
    
    // 发布日期加成（较新的内容）
    const releaseDate = result.release_date || result.first_air_date;
    if (releaseDate) {
      const year = new Date(releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (year >= currentYear - 1) score += 10;
      else if (year >= currentYear - 3) score += 5;
      else if (year >= currentYear - 5) score += 2;
    }
    
    // 流行度加成
    if (result.vote_average > 0 && (result as any).popularity > 10) {
      score += Math.min((result as any).popularity / 100, 5);
    }
    
    return Math.round(score);
  }

  /**
   * 计算字符串相似度（简化版Levenshtein距离）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * 尝试从查询中提取年份信息
   */
  private extractYearFromQuery(query: string): number | null {
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const currentYear = new Date().getFullYear();
      // 只接受合理的年份范围
      if (year >= 1900 && year <= currentYear + 2) {
        return year;
      }
    }
    return null;
  }

  /**
   * 智能搜索剧集，优先搜索电视剧，然后搜索电影
   */
  async smartSearch(title: string, chineseTitle?: string): Promise<string | null> {
    if (!this.config.enabled || !this.config.apiKey) {
      return null;
    }

    // 生成缓存键
    const cacheKey = `${title}|${chineseTitle || ''}`;
    
    // 检查缓存
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    console.log(`开始TMDB搜索: "${title}" (仅使用英文标题)`);

    // 优化查询策略：优先使用最有可能成功的查询
    const prioritizedQueries = this.generatePrioritizedQueries(title, chineseTitle);
    
    console.log(`TMDB搜索查询变体 (${prioritizedQueries.length}个): ${prioritizedQueries.join(', ')}`);

    let bestResult: { url: string; score: number; query: string } | null = null;
    const searchedQueries = new Set<string>();

    // 提取年份信息用于过滤
    const extractedYear = this.extractYearFromQuery(title + ' ' + (chineseTitle || ''));
    
    let searchResult: string | null = null;
    
    try {
      searchResult = await this.performOptimizedSearch(prioritizedQueries, extractedYear, searchedQueries, bestResult);
    } catch (error) {
      console.error('TMDB搜索过程中发生错误:', error);
      searchResult = null;
    }
    
    // 缓存结果
    this.setCachedResult(cacheKey, searchResult);
    
    if (searchResult) {
      console.log(`✅ TMDB搜索成功: ${searchResult}`);
    } else {
      console.log('❌ TMDB搜索未找到匹配结果');
    }
    
    return searchResult;
  }
  
  /**
   * 生成优先级查询列表，仅使用英文标题进行搜索
   */
  private generatePrioritizedQueries(title: string, chineseTitle?: string): string[] {
    const queries: string[] = [];
    
    // 仅使用英文标题（原始标题）
    if (title && title.trim()) {
      queries.push(title.trim());
      
      // 如果需要，添加预处理后的英文标题
      const processed = this.preprocessQuery(title)[0]; // 只取第一个最佳变体
      if (processed && processed !== title.trim() && !queries.includes(processed)) {
        queries.push(processed);
      }
    }
    
    // 去重并限制数量，最多2个查询以减少API压力
    return [...new Set(queries)].slice(0, 2);
  }
  
  /**
   * 执行优化的搜索流程
   */
  private async performOptimizedSearch(
    queries: string[], 
    extractedYear: number | null,
    searchedQueries: Set<string>,
    bestResult: { url: string; score: number; query: string } | null
  ): Promise<string | null> {
    
    for (const query of queries) {
      if (searchedQueries.has(query)) continue;
      searchedQueries.add(query);
      
      try {
        console.log(`正在搜索TMDB: "${query}"${extractedYear ? ` (年份: ${extractedYear})` : ''}`);
        
        // 首先尝试多媒体搜索
        const multiResults = await this.searchMulti(query);
        
        if (multiResults.length > 0) {
          // 计算每个结果的相关性分数
          let scoredResults = multiResults.map(result => ({
            result,
            score: this.calculateRelevanceScore(result, query)
          }));
          
          // 如果有年份信息，优先选择匹配年份的结果
          if (extractedYear) {
            scoredResults = scoredResults.map(item => {
              const releaseDate = item.result.release_date || item.result.first_air_date;
              if (releaseDate) {
                const resultYear = new Date(releaseDate).getFullYear();
                if (Math.abs(resultYear - extractedYear) <= 1) {
                  item.score += 25; // 年份匹配加分
                }
              }
              return item;
            });
          }
          
          scoredResults.sort((a, b) => b.score - a.score);
          
          // 优先选择电视剧结果
          const bestTvResult = scoredResults.find(item => item.result.media_type === 'tv');
          if (bestTvResult && bestTvResult.score > 25) {
            const tmdbUrl = `https://www.themoviedb.org/tv/${bestTvResult.result.id}`;
            if (!bestResult || bestTvResult.score > bestResult.score) {
              bestResult = { url: tmdbUrl, score: bestTvResult.score, query };
              console.log(`找到高分TMDB电视剧链接 (分数: ${bestTvResult.score}): ${tmdbUrl}`);
            }
          }
          
          // 如果没有好的电视剧结果，考虑电影结果
          const bestMovieResult = scoredResults.find(item => item.result.media_type === 'movie');
          if (bestMovieResult && bestMovieResult.score > 25) {
            const tmdbUrl = `https://www.themoviedb.org/movie/${bestMovieResult.result.id}`;
            if (!bestResult || (bestMovieResult.score > bestResult.score && !bestResult.url.includes('/tv/'))) {
              bestResult = { url: tmdbUrl, score: bestMovieResult.score, query };
              console.log(`找到高分TMDB电影链接 (分数: ${bestMovieResult.score}): ${tmdbUrl}`);
            }
          }
        }
        
        // 如果多媒体搜索没有好结果，分别尝试电视剧和电影搜索
        if (!bestResult || bestResult.score < 65) {
          const tvResults = await this.searchTV(query);
          if (tvResults.length > 0) {
            let bestTv = tvResults
              .map(result => ({ result, score: this.calculateRelevanceScore(result, query) }))
              .sort((a, b) => b.score - a.score)[0];
            
            // 年份匹配加分
            if (extractedYear && bestTv.result.first_air_date) {
              const resultYear = new Date(bestTv.result.first_air_date).getFullYear();
              if (Math.abs(resultYear - extractedYear) <= 1) {
                bestTv.score += 25;
              }
            }
            
            if (bestTv.score > 30) {
              const tmdbUrl = `https://www.themoviedb.org/tv/${bestTv.result.id}`;
              if (!bestResult || bestTv.score > bestResult.score) {
                bestResult = { url: tmdbUrl, score: bestTv.score, query };
                console.log(`TV搜索找到高分链接 (分数: ${bestTv.score}): ${tmdbUrl}`);
                
                // 如果找到高分匹配，提前返回以减少API调用
                if (bestTv.score >= 75) {
                  console.log(`🎯 找到高分匹配，提前返回: ${tmdbUrl}`);
                  return tmdbUrl;
                }
              }
            }
          }
          
          const movieResults = await this.searchMovie(query);
          if (movieResults.length > 0) {
            let bestMovie = movieResults
              .map(result => ({ result, score: this.calculateRelevanceScore(result, query) }))
              .sort((a, b) => b.score - a.score)[0];
            
            // 年份匹配加分
            if (extractedYear && bestMovie.result.release_date) {
              const resultYear = new Date(bestMovie.result.release_date).getFullYear();
              if (Math.abs(resultYear - extractedYear) <= 1) {
                bestMovie.score += 25;
              }
            }
            
            if (bestMovie.score > 30) {
              const tmdbUrl = `https://www.themoviedb.org/movie/${bestMovie.result.id}`;
              if (!bestResult || (bestMovie.score > bestResult.score && !bestResult.url.includes('/tv/'))) {
                bestResult = { url: tmdbUrl, score: bestMovie.score, query };
                console.log(`电影搜索找到高分链接 (分数: ${bestMovie.score}): ${tmdbUrl}`);
                
                // 如果找到高分匹配，提前返回以减少API调用
                if (bestMovie.score >= 75) {
                  console.log(`🎯 找到高分匹配，提前返回: ${tmdbUrl}`);
                  return tmdbUrl;
                }
              }
            }
          }
        }
        
        // 如果找到了高分结果，可以提前返回（提高阈值以确保高质量匹配）
        if (bestResult && bestResult.score >= 75) {
          console.log(`找到高质量匹配，提前返回: ${bestResult.url} (查询: "${bestResult.query}")`);
          return bestResult.url;
        }
        
        // 限制搜索次数以避免过多API调用（减少到1次以进一步优化）
        if (searchedQueries.size >= 1) {
          console.log('已达到最大搜索次数限制，停止搜索');
          break;
        }
        
      } catch (error) {
        console.error(`搜索"${query}"时出错:`, error);
        continue;
      }
    }
    
    if (bestResult) {
      console.log(`最终选择TMDB链接 (分数: ${bestResult.score}): ${bestResult.url}`);
      return bestResult.url;
    }
    
    console.log('未找到TMDB链接');
    return null;
  }

  /**
   * 测试API配置是否有效
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/configuration');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取TMDB图片完整URL
   */
  getImageUrl(path: string, size: string = 'w500'): string {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
}

export const tmdbService = new TMDBService();
export default tmdbService;