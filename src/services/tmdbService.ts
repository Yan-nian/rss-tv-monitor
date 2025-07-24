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
}

class TMDBService {
  private baseUrl = 'https://api.themoviedb.org/3';
  private config: TMDBConfig = {
    apiKey: '',
    enabled: false
  };

  setConfig(config: TMDBConfig) {
    this.config = config;
  }

  getConfig(): TMDBConfig {
    return this.config;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}, retries: number = 2) {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('TMDB API未配置或未启用');
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          params: {
            api_key: this.config.apiKey,
            language: 'zh-CN',
            ...params
          },
          timeout: 15000 // 增加超时时间
        });
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
      
      // 如果第一页结果不够好，尝试获取更多结果
      if (results.length < 5 && data.total_pages > 1) {
        try {
          const page2Data = await this.makeRequest('/search/multi', {
            query: query.trim(),
            include_adult: false,
            page: 2
          });
          results.push(...(page2Data.results || []));
        } catch (error) {
          console.warn('获取第二页搜索结果失败:', error);
        }
      }
      
      return results;
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
      
      // 如果第一页结果不够好，尝试获取更多结果
      if (results.length < 5 && data.total_pages > 1) {
        try {
          const page2Data = await this.makeRequest('/search/tv', {
            query: query.trim(),
            include_adult: false,
            page: 2
          });
          const page2Results = page2Data.results?.map((item: any) => ({
            ...item,
            media_type: 'tv' as const
          })) || [];
          results.push(...page2Results);
        } catch (error) {
          console.warn('获取电视剧搜索第二页结果失败:', error);
        }
      }
      
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
      
      // 如果第一页结果不够好，尝试获取更多结果
      if (results.length < 5 && data.total_pages > 1) {
        try {
          const page2Data = await this.makeRequest('/search/movie', {
            query: query.trim(),
            include_adult: false,
            page: 2
          });
          const page2Results = page2Data.results?.map((item: any) => ({
            ...item,
            media_type: 'movie' as const
          })) || [];
          results.push(...page2Results);
        } catch (error) {
          console.warn('获取电影搜索第二页结果失败:', error);
        }
      }
      
      return results;
    } catch (error) {
      console.error('TMDB电影搜索失败:', error);
      return [];
    }
  }

  /**
   * 预处理搜索查询，清理和标准化标题
   */
  private preprocessQuery(query: string): string[] {
    if (!query) return [];
    
    const variants = [];
    let cleanQuery = query.trim();
    
    // 移除常见的无关信息
    cleanQuery = cleanQuery.replace(/\b(S\d+E?\d*|Season\s+\d+|第\d+季|全\d+集)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(\d{4}|\d{3,4}p|HD|4K|BluRay|WEB|HDTV|DVDRip)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(H\.?264|H\.?265|x264|x265|HEVC|AVC)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\b(REMUX|BDRip|WEBRip|HDRip|CAMRip)\b/gi, '');
    cleanQuery = cleanQuery.replace(/\[.*?\]/g, ''); // 移除方括号内容
    cleanQuery = cleanQuery.replace(/\(.*?\)/g, ''); // 移除圆括号内容
    cleanQuery = cleanQuery.replace(/[\-_]+/g, ' '); // 替换连字符和下划线为空格
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim(); // 合并多个空格
    
    if (cleanQuery) {
      variants.push(cleanQuery);
      
      // 如果包含冒号，尝试分割
      if (cleanQuery.includes(':')) {
        const parts = cleanQuery.split(':');
        if (parts.length === 2) {
          variants.push(parts[0].trim());
          variants.push(parts[1].trim());
        }
      }
      
      // 如果包含副标题分隔符，尝试只取主标题
      const subtitleSeparators = [' - ', ' – ', ' — ', ' | ', ' / '];
      for (const sep of subtitleSeparators) {
        if (cleanQuery.includes(sep)) {
          const parts = cleanQuery.split(sep);
          const mainTitle = parts[0].trim();
          if (mainTitle && mainTitle !== cleanQuery && mainTitle.length > 2) {
            variants.push(mainTitle);
          }
          // 也尝试第二部分（可能是英文名）
          if (parts.length > 1) {
            const secondTitle = parts[1].trim();
            if (secondTitle && secondTitle !== cleanQuery && secondTitle.length > 2) {
              variants.push(secondTitle);
            }
          }
        }
      }
      
      // 处理中英文混合标题
      const chineseMatch = cleanQuery.match(/([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)/g);
      const englishMatch = cleanQuery.match(/([A-Za-z][A-Za-z\s]+)/g);
      
      if (chineseMatch && chineseMatch.length > 0) {
        chineseMatch.forEach(match => {
          const cleaned = match.trim().replace(/[·的之]$/, '');
          if (cleaned.length > 1) {
            variants.push(cleaned);
          }
        });
      }
      
      if (englishMatch && englishMatch.length > 0) {
        englishMatch.forEach(match => {
          const cleaned = match.trim();
          if (cleaned.length > 2) {
            variants.push(cleaned);
          }
        });
      }
      
      // 如果标题很长，尝试取前几个关键词
      const words = cleanQuery.split(' ');
      if (words.length > 3) {
        variants.push(words.slice(0, 3).join(' '));
        variants.push(words.slice(0, 2).join(' '));
        
        // 如果第一个词是英文且较长，单独尝试
        if (words[0].length > 3 && /^[A-Za-z]+$/.test(words[0])) {
          variants.push(words[0]);
        }
      }
      
      // 移除常见的无意义词汇
      const meaninglessWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
      const filteredVariants = variants.map(variant => {
        const words = variant.split(' ');
        const filteredWords = words.filter(word => 
          !meaninglessWords.includes(word.toLowerCase()) || words.length <= 2
        );
        return filteredWords.join(' ');
      }).filter(v => v.length > 0);
      
      variants.push(...filteredVariants);
    }
    
    // 去重并过滤掉太短的查询
    return [...new Set(variants)].filter(v => v.length >= 2);
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

    const allQueries = [];
    
    // 添加中文标题的变体（如果有）
    if (chineseTitle && chineseTitle.trim()) {
      const chineseVariants = this.preprocessQuery(chineseTitle);
      allQueries.push(...chineseVariants);
    }
    
    // 添加英文标题的变体
    if (title && title.trim()) {
      const englishVariants = this.preprocessQuery(title);
      allQueries.push(...englishVariants);
    }

    // 去重并按长度排序（较长的查询通常更精确）
    const uniqueQueries = [...new Set(allQueries)].sort((a, b) => b.length - a.length);
    console.log(`TMDB搜索查询变体 (${uniqueQueries.length}个): ${uniqueQueries.join(', ')}`);

    let bestResult: { url: string; score: number; query: string } | null = null;
    const searchedQueries = new Set<string>();

    // 提取年份信息用于过滤
    const extractedYear = this.extractYearFromQuery(title + ' ' + (chineseTitle || ''));
    
    for (const query of uniqueQueries) {
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
        if (!bestResult || bestResult.score < 40) {
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
            
            if (bestTv.score > 25) {
              const tmdbUrl = `https://www.themoviedb.org/tv/${bestTv.result.id}`;
              if (!bestResult || bestTv.score > bestResult.score) {
                bestResult = { url: tmdbUrl, score: bestTv.score, query };
                console.log(`TV搜索找到高分链接 (分数: ${bestTv.score}): ${tmdbUrl}`);
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
            
            if (bestMovie.score > 25) {
              const tmdbUrl = `https://www.themoviedb.org/movie/${bestMovie.result.id}`;
              if (!bestResult || (bestMovie.score > bestResult.score && !bestResult.url.includes('/tv/'))) {
                bestResult = { url: tmdbUrl, score: bestMovie.score, query };
                console.log(`电影搜索找到高分链接 (分数: ${bestMovie.score}): ${tmdbUrl}`);
              }
            }
          }
        }
        
        // 如果找到了高分结果，可以提前返回
        if (bestResult && bestResult.score >= 85) {
          console.log(`找到高质量匹配，提前返回: ${bestResult.url} (查询: "${bestResult.query}")`);
          return bestResult.url;
        }
        
        // 限制搜索次数以避免过多API调用
        if (searchedQueries.size >= 8) {
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
    
    console.log(`未找到"${title}"的TMDB链接`);
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