import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TMDBConfig } from '../services/tmdbService';

// 生成唯一ID的辅助函数
let idCounter = 0;
const generateUniqueId = (): string => {
  idCounter = (idCounter + 1) % 1000000; // 防止溢出
  return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).substr(2, 5);
};

export interface RSSSource {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  lastUpdate: string;
  updateInterval: number; // minutes
}

export interface TVShow {
  id: string;
  title: string;
  chineseTitle?: string; // 中文名
  tmdbLink?: string; // TMDB链接
  firstSeen: string;
  lastSeen: string;
  count: number;
  isNew: boolean;
  category?: string;
  sources: string[]; // 来源RSS源名称列表
  pubDate?: string; // 发布日期
  torrentLink?: string; // 种子链接
}

export interface NotificationConfig {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  discord: {
    enabled: boolean;
    botToken: string;
    channelId: string;
  };
  messageTemplate: string;
}

export interface TMDBSettings {
  apiKey: string;
  enabled: boolean;
  autoSearch: boolean; // 是否自动搜索缺失的TMDB链接
  proxy: {
    enabled: boolean;
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
  };
}

export interface AppState {
  // RSS Sources
  rssSources: RSSSource[];
  addRSSSource: (source: Omit<RSSSource, 'id'>) => void;
  updateRSSSource: (id: string, updates: Partial<RSSSource>) => void;
  removeRSSSource: (id: string) => void;
  
  // TV Shows
  tvShows: TVShow[];
  addTVShow: (show: Omit<TVShow, 'id'>) => void;
  updateTVShow: (id: string, updates: Partial<TVShow>) => void;
  removeTVShow: (id: string) => void;
  clearAllTVShows: () => void;
  markAsRead: (id: string) => void;
  
  // Notifications
  notificationConfig: NotificationConfig;
  updateNotificationConfig: (config: Partial<NotificationConfig>) => void;
  
  // TMDB Settings
  tmdbSettings: TMDBSettings;
  updateTMDBSettings: (settings: Partial<TMDBSettings>) => void;
  
  // Auto-refresh management
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  
  // Notification deduplication
  lastNotifiedShows: string[];
  addNotifiedShow: (title: string) => void;
  clearNotifiedShows: () => void;
  
  // Statistics
  getStats: () => {
    totalShows: number;
    newToday: number;
    newThisWeek: number;
    activeFeeds: number;
  };
}

const useStore = create<AppState>()(persist(
  (set, get) => ({
    rssSources: [],
    tvShows: [],
    autoRefreshEnabled: true,
    lastNotifiedShows: [],
    notificationConfig: {
      telegram: {
        enabled: false,
        botToken: '',
        chatId: '',
      },
      discord: {
        enabled: false,
        botToken: '',
        channelId: '',
      },
      messageTemplate: '🎬 发现新剧集: {{title}}\n中文名: {{chineseTitle}}\n分类: {{category}}\n链接: {{link}}\n种子链接: {{torrentLink}}\n发布时间: {{pubDate}}',
    },
    tmdbSettings: {
      apiKey: '',
      enabled: false,
      autoSearch: true,
      proxy: {
        enabled: false,
        host: '',
        port: 8080,
        username: '',
        password: '',
        protocol: 'http',
      },
    },
    
    addRSSSource: (source) => {
      const newSource: RSSSource = {
        ...source,
        id: generateUniqueId(),
      };
      set((state) => ({
        rssSources: [...state.rssSources, newSource],
      }));
    },
    
    updateRSSSource: (id, updates) => {
      set((state) => ({
        rssSources: state.rssSources.map((source) =>
          source.id === id ? { ...source, ...updates } : source
        ),
      }));
    },
    
    removeRSSSource: (id) => {
      set((state) => ({
        rssSources: state.rssSources.filter((source) => source.id !== id),
      }));
    },
    
    addTVShow: (show) => {
      set((state) => {
        // 查找是否已存在相同剧名
        const existingShowIndex = state.tvShows.findIndex(
          (existingShow) => existingShow.title === show.title
        );
        
        if (existingShowIndex !== -1) {
          // 如果剧名已存在，更新现有记录（只进行次数统计，不标记为新）
          const existingShow = state.tvShows[existingShowIndex];
          const updatedShow = {
            ...existingShow,
            count: existingShow.count + 1,
            lastSeen: new Date().toISOString(),
            // 对于已统计过的剧名，不重新标记为新，保持原有状态
            // 合并RSS源，避免重复
            sources: [...new Set([...existingShow.sources, ...show.sources])],
            // 更新其他字段（如果新数据有值）
            chineseTitle: show.chineseTitle || existingShow.chineseTitle,
            tmdbLink: show.tmdbLink || existingShow.tmdbLink,
            category: show.category || existingShow.category,
            pubDate: show.pubDate || existingShow.pubDate,
            torrentLink: show.torrentLink || existingShow.torrentLink,
          };
          
          const newTvShows = [...state.tvShows];
          newTvShows[existingShowIndex] = updatedShow;
          
          return { tvShows: newTvShows };
        } else {
          // 如果是新剧名，创建新记录
          const newShow: TVShow = {
            ...show,
            id: generateUniqueId(),
            count: 1, // 初始计数为1
          };
          return { tvShows: [...state.tvShows, newShow] };
        }
      });
    },
    
    updateTVShow: (id, updates) => {
      set((state) => ({
        tvShows: state.tvShows.map((show) =>
          show.id === id ? { ...show, ...updates } : show
        ),
      }));
    },
    
    removeTVShow: (id) => {
      set((state) => ({
        tvShows: state.tvShows.filter((show) => show.id !== id),
      }));
    },

    clearAllTVShows: () => {
      set({ tvShows: [] });
    },

    markAsRead: (id) => {
      set((state) => ({
        tvShows: state.tvShows.map((show) =>
          show.id === id ? { ...show, isNew: false } : show
        ),
      }));
    },
    
    updateNotificationConfig: (config) => {
      set((state) => ({
        notificationConfig: {
          ...state.notificationConfig,
          ...config,
        },
      }));
    },
    
    updateTMDBSettings: (settings) => {
      set((state) => ({
        tmdbSettings: {
          ...state.tmdbSettings,
          ...settings,
        },
      }));
    },
    
    setAutoRefreshEnabled: (enabled) => {
      set({ autoRefreshEnabled: enabled });
    },
    
    addNotifiedShow: (title) => {
      set((state) => {
        // 确保 lastNotifiedShows 是数组
        const notifiedList = Array.isArray(state.lastNotifiedShows) ? state.lastNotifiedShows : [];
        if (!notifiedList.includes(title)) {
          return { lastNotifiedShows: [...notifiedList, title] };
        }
        return state;
      });
    },
    
    clearNotifiedShows: () => {
      set({ lastNotifiedShows: [] });
    },
    
    getStats: () => {
      const state = get();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        totalShows: state.tvShows.length,
        newToday: state.tvShows.filter(
          (show) => new Date(show.firstSeen) >= today
        ).length,
        newThisWeek: state.tvShows.filter(
          (show) => new Date(show.firstSeen) >= weekAgo
        ).length,
        activeFeeds: state.rssSources.filter(
          (source) => source.status === 'active'
        ).length,
      };
    },
  }),
  {
    name: 'rss-monitor-storage',
    migrate: (persistedState: any, version: number) => {
      // 确保 lastNotifiedShows 是数组格式
      if (persistedState && persistedState.lastNotifiedShows) {
        // 如果是 Set 类型，转换为数组
        if (persistedState.lastNotifiedShows instanceof Set) {
          persistedState.lastNotifiedShows = Array.from(persistedState.lastNotifiedShows);
        }
        // 如果不是数组，重置为空数组
        if (!Array.isArray(persistedState.lastNotifiedShows)) {
          persistedState.lastNotifiedShows = [];
        }
      }
      return persistedState;
    },
  }
));

export default useStore;