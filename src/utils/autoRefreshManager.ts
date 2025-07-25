import useStore from '../store';
import { rssService } from '../services/rssService';
import { notificationService } from '../services/notificationService';
import { logService } from '../services/logService';
import { toast } from 'sonner';
import axios from 'axios';

class AutoRefreshManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private apiBaseUrl = '/api';

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logService.log('info', 'system', '自动刷新管理器初始化完成');
    
    // 同步后端状态
    this.syncWithBackend();
    
    // 启动定期同步定时器（每30秒检查一次后端状态）
    this.syncTimer = setInterval(() => {
      this.syncWithBackend();
    }, 30000);
    
    logService.log('info', 'system', '已启动与后端的状态同步');
  }

  // 与后端同步RSS源和自动刷新状态
  async syncWithBackend() {
    try {
      // 获取后端的RSS源列表
      const sourcesResponse = await axios.get(`${this.apiBaseUrl}/rss/sources`);
      if (sourcesResponse.data.success) {
        const backendSources = sourcesResponse.data.data;
        const { rssSources, setRSSSources } = useStore.getState();
        
        // 如果后端有数据且与前端不同，则同步到前端
        if (backendSources.length > 0 && JSON.stringify(backendSources) !== JSON.stringify(rssSources)) {
          setRSSSources(backendSources);
          logService.log('info', 'system', `已同步后端RSS源数据，共 ${backendSources.length} 个源`);
        }
      }
      
      // 获取后端的自动刷新状态
      const refreshResponse = await axios.get(`${this.apiBaseUrl}/rss/auto-refresh`);
      if (refreshResponse.data.success) {
        const backendStatus = refreshResponse.data.data;
        const { autoRefreshEnabled, setAutoRefreshEnabled } = useStore.getState();
        
        if (backendStatus.enabled !== autoRefreshEnabled) {
          setAutoRefreshEnabled(backendStatus.enabled);
          logService.log('info', 'system', `已同步后端自动刷新状态: ${backendStatus.enabled}`);
        }
      }
    } catch (error) {
      // 静默处理同步错误，避免干扰用户体验
      console.warn('后端状态同步失败:', error instanceof Error ? error.message : '未知错误');
    }
  }

  // 启动所有定时器（现在委托给后端）
  async startAllTimers() {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/rss/auto-refresh`, {
        enabled: true
      });
      
      if (response.data.success) {
        logService.log('info', 'system', '已启用后端自动刷新');
      }
    } catch (error) {
      logService.log('error', 'system', '启用后端自动刷新失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 启动单个定时器（现在委托给后端）
  async startTimer(sourceId: string, intervalMinutes: number) {
    try {
      const response = await axios.put(`${this.apiBaseUrl}/rss/sources/${sourceId}`, {
        updateInterval: intervalMinutes
      });
      
      if (response.data.success) {
        logService.log('info', 'system', `已更新RSS源定时器: ${sourceId}`, {
          sourceId,
          intervalMinutes
        });
      }
    } catch (error) {
      logService.log('error', 'system', '更新RSS源定时器失败', {
        sourceId,
        intervalMinutes,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 停止单个定时器（前端不再需要管理）
  stopTimer(sourceId: string) {
    // 前端定时器已废弃，这里保留接口兼容性
    logService.log('info', 'system', `停止定时器请求: ${sourceId}（由后端管理）`);
  }

  // 停止所有定时器（现在委托给后端）
  async stopAllTimers() {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/rss/auto-refresh`, {
        enabled: false
      });
      
      if (response.data.success) {
        logService.log('info', 'system', '已禁用后端自动刷新');
      }
    } catch (error) {
      logService.log('error', 'system', '禁用后端自动刷新失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 更新定时器（现在委托给后端）
  async updateTimer(sourceId: string, intervalMinutes: number) {
    await this.startTimer(sourceId, intervalMinutes);
  }

  // 切换自动刷新（现在委托给后端）
  async toggleAutoRefresh(enabled: boolean) {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/rss/auto-refresh`, {
        enabled
      });
      
      if (response.data.success) {
        const { setAutoRefreshEnabled } = useStore.getState();
        setAutoRefreshEnabled(enabled);
        
        logService.log('info', 'system', `自动刷新${enabled ? '已启用' : '已禁用'}`);
        toast.success(`自动刷新${enabled ? '已启用' : '已禁用'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.log('error', 'system', '切换自动刷新失败', { error: errorMessage });
      toast.error(`切换自动刷新失败: ${errorMessage}`);
    }
  }

  private async refreshSource(sourceId: string) {
    const { 
      rssSources, 
      tvShows, 
      notificationConfig, 
      updateRSSSource, 
      addTVShow,
      lastNotifiedShows,
      addNotifiedShow
    } = useStore.getState();
    
    const source = rssSources.find(s => s.id === sourceId);
    if (!source) {
      logService.log('warn', 'system', `自动刷新时未找到RSS源: ${sourceId}`);
      return;
    }

    try {
      logService.log('info', 'system', `开始自动刷新RSS源: ${source.name}`);
      updateRSSSource(sourceId, { status: 'active' });
      
      const feed = await rssService.fetchRSSFeed(source.url);
      const newShows = await rssService.extractTVShows(feed, source.name);
      
      // 检查是否有新的剧名（完全没有统计过的）
      const existingTitles = new Set(tvShows.map(show => show.title));
      const reallyNewShows = newShows.filter(show => !existingTitles.has(show.title));
      const existingShows = newShows.filter(show => existingTitles.has(show.title));
      
      // 添加所有从RSS提取的剧名（包括新的和更新的）
      // 对于已存在的剧名，只更新次数统计，不发送通知
      newShows.forEach(show => addTVShow(show));
      
      logService.log('info', 'system', `自动刷新处理剧集数据`, {
        source: source.name,
        totalExtracted: newShows.length,
        newShows: reallyNewShows.length,
        existingUpdated: existingShows.length
      });
      
      // 只对完全新的剧名发送通知（从未统计过的）
      if (reallyNewShows.length > 0) {
        await notificationService.sendNewShowNotification(notificationConfig, reallyNewShows);
        
        // 记录已通知的剧名
        reallyNewShows.forEach(show => addNotifiedShow(show.title));
        
        logService.log('success', 'notification', `自动刷新发现新剧集并发送通知`, {
          source: source.name,
          newShows: reallyNewShows.length,
          titles: reallyNewShows.map(s => s.title)
        });
      } else {
        logService.log('info', 'system', `自动刷新完成，无新剧集`, {
          source: source.name,
          existingUpdated: existingShows.length
        });
      }
      
      updateRSSSource(sourceId, {
        status: 'active',
        lastUpdate: new Date().toISOString(),
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.log('error', 'system', `自动刷新RSS源失败: ${source.name}`, {
        source: source.name,
        sourceId,
        error: errorMessage
      });
      updateRSSSource(sourceId, { status: 'error' });
    }
  }

  // 手动刷新（会显示toast通知）
  async manualRefreshSource(sourceId: string): Promise<boolean> {
    const { 
      rssSources, 
      tvShows, 
      notificationConfig, 
      updateRSSSource, 
      addTVShow,
      lastNotifiedShows,
      addNotifiedShow
    } = useStore.getState();
    
    const source = rssSources.find(s => s.id === sourceId);
    if (!source) {
      logService.log('warn', 'system', `手动刷新时未找到RSS源: ${sourceId}`);
      return false;
    }

    try {
      logService.log('info', 'system', `开始手动刷新RSS源: ${source.name}`);
      updateRSSSource(sourceId, { status: 'active' });
      
      // 调用后端API进行刷新
      const response = await axios.post(`${this.apiBaseUrl}/rss/refresh/${sourceId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || '后端刷新失败');
      }
      
      const feed = response.data.data;
      const newShows = await rssService.extractTVShows(feed, source.name);
      
      // 检查是否有新的剧名（完全没有统计过的）
      const existingTitles = new Set(tvShows.map(show => show.title));
      const reallyNewShows = newShows.filter(show => !existingTitles.has(show.title));
      const existingShows = newShows.filter(show => existingTitles.has(show.title));
      
      // 添加所有从RSS提取的剧名（包括新的和更新的）
      // 对于已存在的剧名，只更新次数统计，不发送通知
      newShows.forEach(show => addTVShow(show));
      
      logService.log('info', 'system', `手动刷新处理剧集数据`, {
        source: source.name,
        totalExtracted: newShows.length,
        newShows: reallyNewShows.length,
        existingUpdated: existingShows.length
      });
      
      // 只对完全新的剧名发送通知（从未统计过的）
      if (reallyNewShows.length > 0) {
        await notificationService.sendNewShowNotification(notificationConfig, reallyNewShows);
        
        // 记录已通知的剧名
        reallyNewShows.forEach(show => addNotifiedShow(show.title));
        
        logService.log('success', 'notification', `手动刷新发现新剧集并发送通知`, {
          source: source.name,
          newShows: reallyNewShows.length,
          titles: reallyNewShows.map(s => s.title)
        });
        toast.success(`发现 ${reallyNewShows.length} 个新剧名`);
      } else {
        logService.log('info', 'system', `手动刷新完成，无新剧集`, {
          source: source.name,
          existingUpdated: existingShows.length
        });
        if (existingShows.length > 0) {
          toast.info(`更新了 ${existingShows.length} 个已统计剧名的次数`);
        } else {
          toast.info('没有发现新剧名');
        }
      }
      
      updateRSSSource(sourceId, {
        status: 'active',
        lastUpdate: new Date().toISOString(),
      });
      
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.log('error', 'system', `手动刷新RSS源失败: ${source.name}`, {
        source: source.name,
        sourceId,
        error: errorMessage
      });
      updateRSSSource(sourceId, { status: 'error' });
      toast.error(`刷新RSS源失败: ${source.name || source.url} - ${errorMessage}`);
      return false;
    }
  }

  // 手动刷新所有源
  async manualRefreshAllSources(): Promise<void> {
    const { rssSources } = useStore.getState();
    
    logService.log('info', 'system', `开始手动刷新所有RSS源，共 ${rssSources.length} 个源`);
    
    try {
      // 调用后端API批量刷新
      const response = await axios.post(`${this.apiBaseUrl}/rss/refresh-all`);
      
      if (response.data.success) {
        const results = response.data.data;
        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;
        
        logService.log('info', 'system', `手动刷新所有RSS源完成`, {
          total: results.length,
          success: successCount,
          failed: failCount
        });
        
        if (failCount > 0) {
          toast.error(`刷新完成，${successCount} 个成功，${failCount} 个失败`);
        } else {
          toast.success(`所有RSS源刷新完成，共 ${successCount} 个`);
        }
        
        // 同步后端状态到前端
        await this.syncWithBackend();
      } else {
        throw new Error(response.data.error || '批量刷新失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.log('error', 'system', '批量刷新RSS源失败', { error: errorMessage });
      toast.error(`批量刷新失败: ${errorMessage}`);
    }
  }

  // 清理通知记录（可以定期调用，比如每天清理一次）
  clearNotificationHistory() {
    const { clearNotifiedShows } = useStore.getState();
    clearNotifiedShows();
  }

  // 调试方法：获取当前定时器状态
  getTimerStatus() {
    const { rssSources, autoRefreshEnabled } = useStore.getState();
    const status = {
      isInitialized: this.isInitialized,
      autoRefreshEnabled,
      activeTimers: this.timers.size,
      totalSources: rssSources.length,
      timers: Array.from(this.timers.entries()).map(([sourceId, timer]) => {
        const source = rssSources.find(s => s.id === sourceId);
        return {
          sourceId,
          sourceName: source?.name || 'Unknown',
          intervalMinutes: source?.updateInterval || 0,
          hasTimer: !!timer
        };
      })
    };
    
    logService.log('info', 'system', '定时器状态检查', status);
    return status;
  }

  // 强制重启所有定时器
  forceRestartAllTimers() {
    logService.log('info', 'system', '强制重启所有定时器');
    this.stopAllTimers();
    this.startAllTimers();
  }
}

export const autoRefreshManager = new AutoRefreshManager();