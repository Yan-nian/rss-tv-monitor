import useStore from '../store';
import { rssService } from '../services/rssService';
import { notificationService } from '../services/notificationService';
import { logService } from '../services/logService';
import { toast } from 'sonner';

class AutoRefreshManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logService.log('info', 'system', '自动刷新管理器初始化完成');
    
    // 延迟启动定时器，确保store已完全加载
    setTimeout(() => {
      this.startAllTimers();
    }, 1000);
  }

  startAllTimers() {
    const { rssSources, autoRefreshEnabled } = useStore.getState();
    
    if (!autoRefreshEnabled) {
      logService.log('info', 'system', '自动刷新已禁用，跳过启动定时器');
      return;
    }

    logService.log('info', 'system', `启动所有RSS源定时器，共 ${rssSources.length} 个源`);
    rssSources.forEach(source => {
      this.startTimer(source.id, source.updateInterval);
    });
  }

  startTimer(sourceId: string, intervalMinutes: number) {
    // 清除现有定时器
    this.stopTimer(sourceId);
    
    // 验证参数
    if (!sourceId || intervalMinutes <= 0) {
      logService.log('error', 'system', '启动定时器失败：参数无效', {
        sourceId,
        intervalMinutes
      });
      return;
    }
    
    // 设置新定时器
    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      logService.log('info', 'system', `定时器触发: ${sourceId}`);
      this.refreshSource(sourceId);
    }, intervalMs);
    
    this.timers.set(sourceId, timer);
    
    const { rssSources } = useStore.getState();
    const source = rssSources.find(s => s.id === sourceId);
    logService.log('info', 'system', `启动定时器: ${source?.name || sourceId}`, {
      sourceId,
      sourceName: source?.name,
      intervalMinutes,
      intervalMs,
      nextTrigger: new Date(Date.now() + intervalMs).toLocaleString('zh-CN')
    });
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
    
    logService.log('info', 'system', `自动刷新${enabled ? '已启用' : '已禁用'}`);
    
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
      
      // 添加超时保护的RSS获取
      const feedPromise = rssService.fetchRSSFeed(source.url);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RSS获取超时')), 30000);
      });
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);
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
    
    let successCount = 0;
    let failCount = 0;
    
    for (const source of rssSources) {
      try {
        // 为每个源添加超时保护
        const refreshPromise = this.manualRefreshSource(source.id);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`RSS源 ${source.name} 刷新超时`)), 45000);
        });
        
        const success = await Promise.race([refreshPromise, timeoutPromise]);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logService.log('error', 'system', `手动刷新RSS源异常: ${source.name}`, {
          source: source.name,
          sourceId: source.id,
          error: errorMessage
        });
        // 确保即使单个源失败也不会阻塞整个流程
        console.warn(`RSS源 ${source.name} 刷新失败: ${errorMessage}`);
      }
    }
    
    logService.log('info', 'system', `手动刷新所有RSS源完成`, {
      total: rssSources.length,
      success: successCount,
      failed: failCount
    });
    
    if (failCount > 0) {
      toast.error(`刷新完成，${successCount} 个成功，${failCount} 个失败`);
    } else {
      toast.success(`所有RSS源刷新完成，共 ${successCount} 个`);
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