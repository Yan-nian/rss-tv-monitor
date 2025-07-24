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

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('TMDB API未配置或未启用');
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          api_key: this.config.apiKey,
          language: 'zh-CN',
          ...params
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('TMDB API请求失败:', error);
      throw new Error('TMDB API请求失败');
    }
  }

  async searchMulti(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/multi', {
        query: query.trim(),
        include_adult: false
      });
      
      return data.results || [];
    } catch (error) {
      console.error('TMDB搜索失败:', error);
      return [];
    }
  }

  async searchTV(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/tv', {
        query: query.trim(),
        include_adult: false
      });
      
      return data.results?.map((item: any) => ({
        ...item,
        media_type: 'tv' as const
      })) || [];
    } catch (error) {
      console.error('TMDB电视剧搜索失败:', error);
      return [];
    }
  }

  async searchMovie(query: string): Promise<TMDBSearchResult[]> {
    try {
      const data = await this.makeRequest('/search/movie', {
        query: query.trim(),
        include_adult: false
      });
      
      return data.results?.map((item: any) => ({
        ...item,
        media_type: 'movie' as const
      })) || [];
    } catch (error) {
      console.error('TMDB电影搜索失败:', error);
      return [];
    }
  }

  /**
   * 智能搜索剧集，优先搜索电视剧，然后搜索电影
   */
  async smartSearch(title: string, chineseTitle?: string): Promise<string | null> {
    if (!this.config.enabled || !this.config.apiKey) {
      return null;
    }

    const searchQueries = [];
    
    // 添加中文标题（如果有）
    if (chineseTitle && chineseTitle.trim()) {
      searchQueries.push(chineseTitle.trim());
    }
    
    // 添加英文标题
    if (title && title.trim()) {
      searchQueries.push(title.trim());
    }

    for (const query of searchQueries) {
      try {
        console.log(`正在搜索TMDB: "${query}"`);
        
        // 首先尝试多媒体搜索
        const multiResults = await this.searchMulti(query);
        
        if (multiResults.length > 0) {
          // 优先选择电视剧结果
          const tvResult = multiResults.find(result => result.media_type === 'tv');
          if (tvResult) {
            const tmdbUrl = `https://www.themoviedb.org/tv/${tvResult.id}`;
            console.log(`找到TMDB电视剧链接: ${tmdbUrl}`);
            return tmdbUrl;
          }
          
          // 如果没有电视剧，选择电影结果
          const movieResult = multiResults.find(result => result.media_type === 'movie');
          if (movieResult) {
            const tmdbUrl = `https://www.themoviedb.org/movie/${movieResult.id}`;
            console.log(`找到TMDB电影链接: ${tmdbUrl}`);
            return tmdbUrl;
          }
          
          // 如果有其他类型的结果，选择第一个
          const firstResult = multiResults[0];
          if (firstResult) {
            const type = firstResult.media_type === 'tv' ? 'tv' : 'movie';
            const tmdbUrl = `https://www.themoviedb.org/${type}/${firstResult.id}`;
            console.log(`找到TMDB链接: ${tmdbUrl}`);
            return tmdbUrl;
          }
        }
        
        // 如果多媒体搜索没有结果，分别尝试电视剧和电影搜索
        const tvResults = await this.searchTV(query);
        if (tvResults.length > 0) {
          const tmdbUrl = `https://www.themoviedb.org/tv/${tvResults[0].id}`;
          console.log(`找到TMDB电视剧链接: ${tmdbUrl}`);
          return tmdbUrl;
        }
        
        const movieResults = await this.searchMovie(query);
        if (movieResults.length > 0) {
          const tmdbUrl = `https://www.themoviedb.org/movie/${movieResults[0].id}`;
          console.log(`找到TMDB电影链接: ${tmdbUrl}`);
          return tmdbUrl;
        }
        
      } catch (error) {
        console.error(`搜索"${query}"时出错:`, error);
        continue;
      }
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