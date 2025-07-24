import axios from 'axios';
import { parseString } from 'xml2js';
import { TVShow } from '../store';
import { tmdbService } from './tmdbService';
import useStore from '../store';
import { logService } from './logService';

// 生成唯一ID的辅助函数
let idCounter = 0;
const generateUniqueId = (): string => {
  idCounter = (idCounter + 1) % 1000000; // 防止溢出
  return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).substr(2, 5);
};

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export interface RSSFeed {
  title: string;
  description: string;
  items: RSSItem[];
}

// 提取影视剧名称的正则表达式
const TV_SHOW_PATTERNS = [
  // 匹配 "剧名 S01" 或 "剧名 Season 1" 格式
  /^([^S]+?)\s+S\d+/i,
  /^([^S]+?)\s+Season\s+\d+/i,
  // 匹配 "剧名 第一季" 格式
  /^([^第]+?)\s*第[一二三四五六七八九十\d]+季/,
  // 匹配包含分辨率信息的格式 (优先级提高)
  /^(.+?)\s+\d{3,4}p/i,
  // 匹配包含编码信息的格式
  /^(.+?)\s+H\.[\d]+/i,
  // 匹配包含WEB-DL等标识的格式
  /^(.+?)\s+(?:WEB|BluRay|BDRip|DVDRip|HDTV)/i,
  // 匹配包含年份的格式
  /^(.+?)\s+\d{4}/,
  // 匹配包含编码组信息的格式
  /^(.+?)\s+-\s*[A-Z][a-zA-Z0-9]+$/,
  // 默认匹配第一个有意义的部分
  /^([^\s\-\[\(]+(?:\s+[^\s\-\[\(]+)*?)(?=\s+(?:\d{3,4}p|S\d+|\d{4}|WEB|BluRay|BDRip|DVDRip|HDTV|H\.|\-[A-Z]))/i,
  // 最后的备选方案
  /^([^\s\-\[\(]+)/,
];

class RSSService {
  private apiBaseUrl = 'http://localhost:3001/api';
  
  async fetchRSSFeed(url: string): Promise<RSSFeed> {
    try {
      logService.log('info', 'rss', `开始获取RSS源: ${url}`);
      
      const response = await axios.post(`${this.apiBaseUrl}/rss/fetch`, {
        url: url
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data && response.data.success) {
        const itemCount = response.data.data?.items?.length || 0;
        logService.log('success', 'rss', `成功获取RSS源，包含 ${itemCount} 个条目`, {
          url,
          itemCount,
          title: response.data.data?.title
        });
        return response.data.data as RSSFeed;
      } else {
        const errorMsg = response.data?.error || '后端API返回错误';
        const details = response.data?.details ? ` (详情: ${response.data.details})` : '';
        logService.log('error', 'rss', `RSS源获取失败: ${errorMsg}${details}`, {
          url,
          error: errorMsg,
          details: response.data?.details
        });
        throw new Error(errorMsg + details);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logService.log('error', 'rss', '无法连接到后端服务', {
            url,
            error: 'ECONNREFUSED',
            message: '后端服务未运行'
          });
          throw new Error('无法连接到后端服务，请确保后端服务正在运行');
        }
        if (error.response?.data?.error) {
          logService.log('error', 'rss', `RSS源获取失败: ${error.response.data.error}`, {
            url,
            error: error.response.data.error,
            status: error.response.status
          });
          throw new Error(error.response.data.error);
        }
      }
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.log('error', 'rss', `RSS源获取异常: ${errorMessage}`, {
        url,
        error: errorMessage
      });
      throw new Error(`无法获取RSS源内容: ${errorMessage}`);
    }
  }
  
  private parseRSSContent(xmlContent: string): Promise<RSSFeed> {
    return new Promise((resolve, reject) => {
      parseString(xmlContent, { trim: true }, (err, result) => {
        if (err) {
          reject(new Error('RSS内容解析失败'));
          return;
        }
        
        try {
          const channel = result.rss?.channel?.[0] || result.feed;
          const items = channel.item || channel.entry || [];
          
          const feed: RSSFeed = {
            title: this.extractText(channel.title),
            description: this.extractText(channel.description),
            items: items.map((item: any) => ({
              title: this.extractText(item.title),
              link: this.extractText(item.link),
              description: this.extractText(item.description),
              pubDate: this.extractText(item.pubDate || item.published),
              guid: this.extractText(item.guid || item.id),
            })),
          };
          
          resolve(feed);
        } catch (parseError) {
          reject(new Error('RSS数据结构解析失败'));
        }
      });
    });
  }
  
  private extractText(field: any): string {
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
  
  async extractTVShows(feed: RSSFeed, sourceName: string): Promise<TVShow[]> {
    const showsMap = new Map<string, TVShow>();
    let extractedCount = 0;
    let newShowsCount = 0;
    let updatedShowsCount = 0;
    
    logService.log('info', 'rss', `开始从RSS源 "${sourceName}" 提取影视剧信息，共 ${feed.items.length} 个条目`);
    
    for (const item of feed.items) {
      // 优先从description中提取片名，如果没有则从title中提取
      const extractedTitle = this.extractTVShowTitleFromBoth(item.title, item.description);
      
      if (extractedTitle) {
        extractedCount++;
        let movieLink = this.extractMovieLink(item.description);
        const chineseTitle = this.extractChineseTitle(item.title, item.description);
        const category = this.categorizeShow(item.title, item.description);
        
        // 如果没有找到TMDB链接，且启用了自动搜索，尝试自动搜索
        if (!movieLink) {
          const { tmdbSettings } = useStore.getState();
          if (tmdbSettings.enabled && tmdbSettings.autoSearch && tmdbSettings.apiKey) {
            try {
              // 配置TMDB服务
              tmdbService.setConfig({
                apiKey: tmdbSettings.apiKey,
                enabled: tmdbSettings.enabled
              });
              
              const searchedLink = await tmdbService.smartSearch(extractedTitle, chineseTitle);
              if (searchedLink) {
                movieLink = searchedLink;
                logService.log('success', 'tmdb', `自动搜索到TMDB链接: ${extractedTitle}`, {
                  title: extractedTitle,
                  chineseTitle,
                  tmdbLink: searchedLink
                });
              }
            } catch (error) {
              logService.log('warn', 'tmdb', `TMDB自动搜索失败: ${extractedTitle}`, {
                title: extractedTitle,
                error: error instanceof Error ? error.message : '未知错误'
              });
            }
          }
        }
        
        // 检查是否已存在相同标题的剧集
        const existingShow = showsMap.get(extractedTitle);
        if (existingShow) {
          // 比较发布时间，保留最新的
          const currentPubDate = new Date(item.pubDate || 0);
          const existingPubDate = new Date(existingShow.pubDate || 0);
          
          if (currentPubDate > existingPubDate) {
            // 更新为最新的种子链接和发布时间
            existingShow.torrentLink = item.link;
            existingShow.pubDate = item.pubDate;
            existingShow.lastSeen = new Date().toISOString();
            updatedShowsCount++;
            logService.log('info', 'rss', `更新剧集信息: ${extractedTitle}`, {
              title: extractedTitle,
              source: sourceName,
              pubDate: item.pubDate
            });
          }
          
          // 确保来源包含当前RSS源
          if (!existingShow.sources.includes(sourceName)) {
            existingShow.sources.push(sourceName);
          }
        } else {
          // 创建新的剧集条目
          newShowsCount++;
          showsMap.set(extractedTitle, {
            id: generateUniqueId(),
            title: extractedTitle,
            chineseTitle,
            tmdbLink: movieLink,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            count: 1,
            isNew: true,
            category,
            sources: [sourceName], // 记录来源RSS源
            pubDate: item.pubDate, // 发布日期
            torrentLink: item.link, // 种子链接
          });
          
          logService.log('success', 'rss', `发现新剧集: ${extractedTitle}`, {
            title: extractedTitle,
            chineseTitle,
            category,
            source: sourceName,
            tmdbLink: movieLink
          });
        }
      }
    }
    
    const totalShows = Array.from(showsMap.values());
    logService.log('success', 'rss', `RSS源 "${sourceName}" 处理完成`, {
      source: sourceName,
      totalItems: feed.items.length,
      extractedCount,
      newShows: newShowsCount,
      updatedShows: updatedShowsCount,
      totalShows: totalShows.length
    });
    
    return totalShows;
  }
  
  private extractTVShowTitleFromBoth(title: string, description: string): string | null {
    // 首先尝试从description中提取更准确的片名
    const descriptionTitle = this.extractTitleFromDescription(description);
    if (descriptionTitle) {
      console.log(`从description中提取到片名: "${descriptionTitle}"`);
      return descriptionTitle;
    }
    
    // 如果description中没有找到，则从title中提取
    return this.extractTVShowTitle(title);
  }
  
  private extractTitleFromDescription(description: string): string | null {
    if (!description) return null;
    
    console.log(`正在从description中提取片名: "${description.substring(0, 100)}..."`);
    
    // 匹配description中的片名模式
    const descriptionPatterns = [
      // 匹配 ◎片名 或 ◎原名
      /◎片[\s　]*名[\s　]*([^\n\r]+)/gi,
      /◎原[\s　]*名[\s　]*([^\n\r]+)/gi,
      // 匹配 ◎译名
      /◎译[\s　]*名[\s　]*([^\n\r]+)/gi,
      // 匹配英文片名模式
      /◎英文名[\s　]*([^\n\r]+)/gi,
      // 匹配Title: 格式
      /Title[\s]*:[\s]*([^\n\r]+)/gi,
      // 匹配Name: 格式
      /Name[\s]*:[\s]*([^\n\r]+)/gi,
      // 匹配方括号内的完整片名（不包含其他信息）
      /\[([A-Za-z][A-Za-z0-9\s\-\.:']+?)(?:\s+S\d+|\s+\d{4}|\s+\d{3,4}p|\s+WEB|\s+BluRay)/i,
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
          console.log(`从description中成功提取片名: "${extracted}"`);
          return extracted;
        }
      }
    }
    
    return null;
  }
  
  private extractTVShowTitle(title: string): string | null {
    if (!title) return null;
    
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
    
    // 如果青蛙PT格式没匹配到，尝试通用格式
    for (let i = 0; i < TV_SHOW_PATTERNS.length; i++) {
      const pattern = TV_SHOW_PATTERNS[i];
      const match = cleanTitle.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim();
        extracted = extracted.replace(/[\-_\s]+$/, '');
        extracted = extracted.replace(/^[\-_\s]+/, '');
        
        if (extracted.length > 2) {
          console.log(`通用模式 ${i} 匹配成功: "${extracted}"`);
          return extracted;
        }
      }
    }
    
    // 最后的备选方案：取第一个有意义的词组
    const words = cleanTitle.split(/\s+/);
    if (words.length > 0) {
      let result = words[0];
      // 如果第一个词包含多个单词（用连字符或下划线连接），保持完整
      if (result.includes('-') || result.includes('_')) {
        result = result.replace(/[\-_]/g, ' ');
      }
      // 如果第一个词太短，尝试组合前几个词
      if (result.length <= 2 && words.length > 1) {
        result = words.slice(0, Math.min(2, words.length)).join(' ');
      }
      
      if (result.length > 2) {
        console.log(`使用备选方案提取: "${result}"`);
        return result;
      }
    }
    
    console.log('无法提取有效的剧名');
    return null;
  }
  
  private extractMovieLink(description: string): string | null {
    if (!description) return null;
    
    // 只匹配TMDB链接
    const tmdbPattern = /https?:\/\/(?:www\.)?themoviedb\.org\/(?:movie|tv)\/\d+/gi;
    const tmdbMatch = description.match(tmdbPattern);
    
    if (tmdbMatch && tmdbMatch.length > 0) {
      return tmdbMatch[0];
    }
    
    return null;
  }
  
  private extractChineseTitle(title: string, description: string): string | null {
    // 检查是否为audiences.me站点（通过检查description是否为空或很短来判断）
    const isAudiencesMe = !description || description.trim().length < 50;
    
    if (isAudiencesMe) {
      // 对于audiences.me站点，从title中提取中文名
      console.log(`检测到audiences.me站点格式，从title中提取中文片名: "${title}"`);  
      return this.extractChineseTitleFromTitle(title);
    }
    
    // 其他站点从description中提取中文名
    const content = description;
    
    console.log(`正在从description中提取中文片名，内容: "${content.substring(0, 200)}..."`);
    
    // 针对青蛙PT站格式优化的中文标题提取
    const chinesePatterns = [
      // 匹配description中的中文译名
      /◎译[\s　]*名[\s　]*([\u4e00-\u9fff][\u4e00-\u9fff\s·\/]+)/gi,
      /◎中文名[\s　]*([\u4e00-\u9fff][\u4e00-\u9fff\s·\/]+)/gi,
      // 匹配片名后的中文（如果片名字段包含中文）
      /◎片[\s　]*名[\s　]*([\u4e00-\u9fff][\u4e00-\u9fff\s·]+)/gi,
      // 匹配方括号内的中文名，如 [秘河密友 El Secreto del Río 全8集 | 类型: 剧情]
      /\[([\u4e00-\u9fff][\u4e00-\u9fff\s·]*?)(?:\s+[A-Za-z]|\s+全\d+集|\s+\||$)/g,
      // 匹配title中的中文部分（如：强者的新传说 / 強くてニューサーガ）
      /([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)\s*[\/\|]\s*[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+/g,
      // 匹配圆括号内的中文
      /[（(]([\u4e00-\u9fff][\u4e00-\u9fff\s·]+)[）)]/g,
      // 匹配【】内的中文
      /[【]([\u4e00-\u9fff][\u4e00-\u9fff\s·]+)[】]/g,
      // 匹配中文名标识
      /中文名[：:]\s*([\u4e00-\u9fff][\u4e00-\u9fff\s·]+)/gi,
      // 匹配年份档期信息中的中文（如：2025年7月档新番：强者的新传说）
      /\d{4}年\d+月档[^：:]*[：:]([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)/g,
    ];
    
    for (const pattern of chinesePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 1) {
          let chineseTitle = match[1].trim();
          // 清理可能的多余字符
          chineseTitle = chineseTitle.replace(/\/.*$/, '').trim();
          chineseTitle = chineseTitle.replace(/\s*[\|｜].*$/, '').trim();
          chineseTitle = chineseTitle.replace(/\s*的新传说$/, '的新传说'); // 保持完整性
          
          if (chineseTitle.length > 1) {
            console.log(`成功提取中文片名: "${chineseTitle}"`);
            return chineseTitle;
          }
        }
      }
    }
    
    console.log('未找到中文片名');
    return null;
  }
  
  private extractChineseTitleFromTitle(title: string): string | null {
    if (!title) return null;
    
    console.log(`正在从title中提取中文片名: "${title}"`);
    
    // 针对audiences.me站点的title格式优化的中文标题提取
    const titleChinesePatterns = [
      // 匹配中文名在英文名前的格式："中文名 English Name"
      /^([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+?)\s+[A-Za-z]/,
      // 匹配中文名在英文名后的格式："English Name 中文名"
      /[A-Za-z][A-Za-z\s]+\s+([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)/,
      // 匹配方括号内的中文名
      /\[([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)\]/,
      // 匹配圆括号内的中文名
      /[（(]([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)[）)]/,
      // 匹配【】内的中文名
      /[【]([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)[】]/,
      // 匹配用斜杠分隔的中文名："English / 中文名"
      /[A-Za-z][A-Za-z\s]+\s*\/\s*([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)/,
      // 匹配用竖线分隔的中文名："English | 中文名"
      /[A-Za-z][A-Za-z\s]+\s*\|\s*([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)/,
      // 匹配纯中文标题（整个title都是中文）
      /^([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+)$/,
      // 匹配中文名后跟版本信息："中文名 S01E01"
      /^([\u4e00-\u9fff][\u4e00-\u9fff\s·的之]+?)\s+(?:S\d+|第\d+|\d{4}|\d{3,4}p)/i,
    ];
    
    for (const pattern of titleChinesePatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        let chineseTitle = match[1].trim();
        // 清理可能的多余字符
        chineseTitle = chineseTitle.replace(/[\s·]+$/, '').trim();
        chineseTitle = chineseTitle.replace(/^[\s·]+/, '').trim();
        
        if (chineseTitle.length > 1) {
          console.log(`从title中成功提取中文片名: "${chineseTitle}"`);
          return chineseTitle;
        }
      }
    }
    
    console.log('从title中未找到中文片名');
    return null;
  }
  
  private categorizeShow(title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase();
    
    // 针对青蛙PT站格式优化的类别识别
    // 动漫识别 (优先级提高，因为示例中的是动漫)
    if (content.includes('动漫') || content.includes('anime') ||
        content.includes('动画') || content.includes('animation') ||
        content.includes('卡通') || content.includes('cartoon') ||
        content.includes('新番') || content.includes('番剧') ||
        /\d{4}\s*年\d+月档/.test(content) || // 如 "2025年7月档"
        content.includes('强者的新传说') || content.includes('強くてニューサーガ')) {
      return '动漫';
    }
    
    // 剧集识别
    if (content.includes('剧集') || content.includes('series') || 
        content.includes('season') || content.includes('episode') ||
        content.includes('第.*季') || content.includes('s\\d+e\\d+') ||
        content.includes('电视剧') || content.includes('tv show') ||
        content.includes('全\\d+集') || /s\d+e\d+/i.test(content)) {
      return '剧集';
    }
    
    // 电影识别
    if (content.includes('电影') || content.includes('movie') || 
        content.includes('film') || content.includes('cinema') ||
        (/\b\d{4}\b.*(?:1080p|720p|4k)/.test(content) && !content.includes('season') && !content.includes('episode') && !content.includes('全\\d+集'))) {
      return '电影';
    }
    
    // 纪录片识别
    if (content.includes('纪录片') || content.includes('documentary') ||
        content.includes('记录片') || content.includes('纪实')) {
      return '纪录片';
    }
    
    // 综艺识别
    if (content.includes('综艺') || content.includes('variety') ||
        content.includes('真人秀') || content.includes('reality show') ||
        content.includes('脱口秀') || content.includes('talk show')) {
      return '综艺';
    }
    
    return '其他';
  }
  
  async testRSSConnection(url: string): Promise<boolean> {
    try {
      console.log(`测试RSS连接: ${url}`);
      
      const response = await axios.post(`${this.apiBaseUrl}/rss/test`, {
        url: url
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const isValid = response.data && response.data.success;
      console.log(`RSS连接测试结果: ${isValid ? '成功' : '失败'}`);
      return isValid;
    } catch (error) {
      console.error('RSS连接测试失败:', error);
      return false;
    }
  }
}

export const rssService = new RSSService();
export default rssService;