import useStore from '../store';
import { rssService } from '../services/rssService';
import { notificationService } from '../services/notificationService';
import { toast } from 'sonner';

class AutoRefreshManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.startAllTimers();
  }

  startAllTimers() {
    const { rssSources, autoRefreshEnabled } = useStore.getState();
    
    if (!autoRefreshEnabled) return;

    rssSources.forEach(source => {
      this.startTimer(source.id, source.updateInterval);
    });
  }

  startTimer(sourceId: string, intervalMinutes: number) {
    // 清除现有定时器
    this.stopTimer(sourceId);
    
    // 设置新定时器
    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      this.refreshSource(sourceId);
    }, intervalMs);
    
    this.timers.set(sourceId, timer);
  }

  stopTimer(sourceId: string) {
    const timer = this.timers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sourceId);
    }
  }

  stopAllTimers() {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }

  updateTimer(sourceId: string, intervalMinutes: number) {
    const { autoRefreshEnabled } = useStore.getState();
    if (autoRefreshEnabled) {
      this.startTimer(sourceId, intervalMinutes);
    }
  }

  toggleAutoRefresh(enabled: boolean) {
    const { setAutoRefreshEnabled } = useStore.getState();
    setAutoRefreshEnabled(enabled);
    
    if (enabled) {
      this.startAllTimers();
    } else {
      this.stopAllTimers();
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
    if (!source) return;

    try {
      updateRSSSource(sourceId, { status: 'active' });
      
      const feed = await rssService.fetchRSSFeed(source.url);
      const newShows = await rssService.extractTVShows(feed, source.name);
      
      // 检查是否有新的剧名
      const existingTitles = new Set(tvShows.map(show => show.title));
      const reallyNewShows = newShows.filter(show => !existingTitles.has(show.title));
      
      // 过滤掉已经通知过的剧名（避免重复通知）
      // 确保 lastNotifiedShows 是数组
      const notifiedList = Array.isArray(lastNotifiedShows) ? lastNotifiedShows : [];
      const showsToNotify = reallyNewShows.filter(show => !notifiedList.includes(show.title));
      
      // 添加新发现的剧名
      reallyNewShows.forEach(show => addTVShow(show));
      
      // 发送通知（只通知未通知过的）
      if (showsToNotify.length > 0) {
        await notificationService.sendNewShowNotification(notificationConfig, showsToNotify);
        
        // 记录已通知的剧名
        showsToNotify.forEach(show => addNotifiedShow(show.title));
        
        console.log(`自动刷新发现 ${showsToNotify.length} 个新剧名:`, showsToNotify.map(s => s.title));
      }
      
      updateRSSSource(sourceId, {
        status: 'active',
        lastUpdate: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('自动刷新RSS源错误:', error);
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
    if (!source) return false;

    try {
      updateRSSSource(sourceId, { status: 'active' });
      
      const feed = await rssService.fetchRSSFeed(source.url);
      const newShows = await rssService.extractTVShows(feed, source.name);
      
      // 检查是否有新的剧名
      const existingTitles = new Set(tvShows.map(show => show.title));
      const reallyNewShows = newShows.filter(show => !existingTitles.has(show.title));
      
      // 过滤掉已经通知过的剧名（避免重复通知）
      // 确保 lastNotifiedShows 是数组
      const notifiedList = Array.isArray(lastNotifiedShows) ? lastNotifiedShows : [];
      const showsToNotify = reallyNewShows.filter(show => !notifiedList.includes(show.title));
      
      // 添加新发现的剧名
      reallyNewShows.forEach(show => addTVShow(show));
      
      // 发送通知（只通知未通知过的）
      if (showsToNotify.length > 0) {
        await notificationService.sendNewShowNotification(notificationConfig, showsToNotify);
        
        // 记录已通知的剧名
        showsToNotify.forEach(show => addNotifiedShow(show.title));
        
        toast.success(`发现 ${showsToNotify.length} 个新剧名`);
      } else if (reallyNewShows.length > 0) {
        toast.info(`发现 ${reallyNewShows.length} 个剧名（已通知过，跳过通知）`);
      } else {
        toast.info('没有发现新剧名');
      }
      
      updateRSSSource(sourceId, {
        status: 'active',
        lastUpdate: new Date().toISOString(),
      });
      
      return true;
      
    } catch (error) {
      console.error('手动刷新RSS源错误:', error);
      updateRSSSource(sourceId, { status: 'error' });
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`刷新RSS源失败: ${source.name || source.url} - ${errorMessage}`);
      return false;
    }
  }

  // 手动刷新所有源
  async manualRefreshAllSources(): Promise<void> {
    const { rssSources } = useStore.getState();
    
    for (const source of rssSources) {
      await this.manualRefreshSource(source.id);
    }
  }

  // 清理通知记录（可以定期调用，比如每天清理一次）
  clearNotificationHistory() {
    const { clearNotifiedShows } = useStore.getState();
    clearNotifiedShows();
  }
}

export const autoRefreshManager = new AutoRefreshManager();