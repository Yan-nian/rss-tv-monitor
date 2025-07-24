import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, X, Bug, Rss, XCircle } from 'lucide-react';
import useStore from '../store';
import { rssService } from '../services/rssService';
import { notificationService } from '../services/notificationService';
import { autoRefreshManager } from '../utils/autoRefreshManager';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const {
    rssSources,
    addRSSSource,
    updateRSSSource,
    tvShows,
    addTVShow,
    notificationConfig,
    getStats,
  } = useStore();
  
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  
  const stats = getStats();
  
  useEffect(() => {
    // 初始化自动刷新管理器
    autoRefreshManager.initialize();
    
    // 延迟检查定时器状态
    const checkTimer = setTimeout(() => {
      const status = autoRefreshManager.getTimerStatus();
      console.log('Dashboard初始化后定时器状态:', status);
    }, 2000);
    
    return () => clearTimeout(checkTimer);
  }, []);
  
  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      toast.error('请填写完整的RSS源信息');
      return;
    }
    
    try {
      // 测试RSS连接
      const isValid = await rssService.testRSSConnection(newSourceUrl);
      if (!isValid) {
        toast.error('RSS源连接失败，请检查URL是否正确');
        return;
      }
      
      const newSource = {
        name: newSourceName,
        url: newSourceUrl,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
        updateInterval: 30, // 默认30分钟
      };
      
      addRSSSource(newSource);
      
      // 为新添加的RSS源启动定时器
      // 注意：由于addRSSSource会生成新的id，我们需要从store中获取最新添加的源
      setTimeout(() => {
        const { rssSources } = useStore.getState();
        const latestSource = rssSources[rssSources.length - 1];
        if (latestSource) {
          autoRefreshManager.updateTimer(latestSource.id, latestSource.updateInterval);
        }
      }, 0);
      
      setNewSourceName('');
      setNewSourceUrl('');
      setIsAddingSource(false);
      toast.success('RSS源添加成功');
    } catch (error) {
      toast.error('添加RSS源失败');
    }
  };
  
  const refreshSource = async (sourceId: string) => {
    setIsRefreshing(sourceId);
    
    try {
      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('刷新超时')), 60000); // 60秒超时
      });
      
      const refreshPromise = autoRefreshManager.manualRefreshSource(sourceId);
      const success = await Promise.race([refreshPromise, timeoutPromise]);
      
      if (!success) {
        console.warn(`RSS源 ${sourceId} 刷新失败`);
        toast.error('RSS源刷新失败');
      }
    } catch (error) {
      console.error('刷新RSS源时发生异常:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`刷新失败: ${errorMessage}`);
    } finally {
      // 确保状态一定会被清除
      setIsRefreshing(null);
    }
  };
  
  const refreshAllSources = async () => {
    setIsRefreshingAll(true);
    try {
      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('批量刷新超时')), 120000); // 120秒超时
      });
      
      const refreshPromise = autoRefreshManager.manualRefreshAllSources();
      await Promise.race([refreshPromise, timeoutPromise]);
    } catch (error) {
      console.error('刷新所有RSS源失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`批量刷新失败: ${errorMessage}`);
    } finally {
      // 确保状态一定会被清除
      setIsRefreshingAll(false);
    }
  };

  const debugRefreshStatus = () => {
    const status = autoRefreshManager.getTimerStatus();
    console.log('当前刷新状态:', status);
    console.log('前端刷新状态:', { isRefreshing, isRefreshingAll });
    toast.info(`定时器状态: ${status.activeTimers}/${status.totalSources} 个活跃`);
  };

  const forceStopRefresh = () => {
    setIsRefreshing(null);
    setIsRefreshingAll(false);
    toast.success('已强制停止所有刷新操作');
    console.log('强制停止刷新状态');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '正常';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    总剧名数量
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.totalShows}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    今日新增
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.newToday}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    本周新增
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.newThisWeek}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <RefreshCw className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    活跃RSS源
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.activeFeeds}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* RSS源管理 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              RSS源管理
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={debugRefreshStatus}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Clock className="w-4 h-4 mr-2" />
                调试状态
              </button>
              {(isRefreshingAll || isRefreshing) && (
                <button
                  onClick={forceStopRefresh}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  强制停止
                </button>
              )}
              <button
                onClick={refreshAllSources}
                disabled={isRefreshingAll}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                {isRefreshingAll ? '刷新中...' : '全部刷新'}
              </button>
              <button
                onClick={() => setIsAddingSource(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加RSS源
              </button>
            </div>
          </div>
          
          {/* 添加RSS源表单 */}
          {isAddingSource && (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSS源名称
                  </label>
                  <input
                    type="text"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="例如：青蛙PT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSS URL
                  </label>
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setIsAddingSource(false)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSource}
                  className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
            </div>
          )}
          
          {/* RSS源列表 */}
          <div className="space-y-4">
            {rssSources.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">暂无RSS源，请添加一个开始监控</p>
              </div>
            ) : (
              rssSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(source.status)}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {source.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        状态: {getStatusText(source.status)} | 
                        最后更新: {new Date(source.lastUpdate).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => refreshSource(source.id)}
                    disabled={isRefreshing === source.id}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${isRefreshing === source.id ? 'animate-spin' : ''}`}
                    />
                    {isRefreshing === source.id ? '刷新中...' : '刷新'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;