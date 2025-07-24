import React, { useState } from 'react';
import { Settings as SettingsIcon, Trash2, Edit, Save, X, Download, Upload, RefreshCw, Key, Eye, EyeOff } from 'lucide-react';
import useStore from '../store';
import { rssService } from '../services/rssService';
import { autoRefreshManager } from '../utils/autoRefreshManager';
import { tmdbService } from '../services/tmdbService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const Settings: React.FC = () => {
  const {
    rssSources,
    addRSSSource,
    updateRSSSource,
    removeRSSSource,
    tvShows,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    clearNotifiedShows,
    tmdbSettings,
    updateTMDBSettings,
  } = useStore();
  
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', updateInterval: 30 });
  const [isTestingConnection, setIsTestingConnection] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingTMDB, setIsTestingTMDB] = useState(false);
  
  const handleEditSource = (source: any) => {
    setEditingSource(source.id);
    setEditForm({
      name: source.name,
      url: source.url,
      updateInterval: source.updateInterval,
    });
  };
  
  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.url.trim()) {
      toast.error('请填写完整的RSS源信息');
      return;
    }
    
    try {
      // 测试连接
      setIsTestingConnection(editingSource);
      const isValid = await rssService.testRSSConnection(editForm.url);
      
      if (!isValid) {
        toast.error('RSS源连接失败，请检查URL是否正确');
        return;
      }
      
      updateRSSSource(editingSource!, {
        name: editForm.name,
        url: editForm.url,
        updateInterval: editForm.updateInterval,
        status: 'active',
      });
      
      // 更新自动刷新定时器
      autoRefreshManager.updateTimer(editingSource!, editForm.updateInterval);
      
      setEditingSource(null);
      toast.success('RSS源更新成功');
    } catch (error) {
      toast.error('更新RSS源失败');
    } finally {
      setIsTestingConnection(null);
    }
  };
  
  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditForm({ name: '', url: '', updateInterval: 30 });
  };
  
  const handleDeleteSource = (sourceId: string, sourceName: string) => {
    if (window.confirm(`确定要删除RSS源 "${sourceName}" 吗？`)) {
      // 停止对应的自动刷新定时器
      autoRefreshManager.stopTimer(sourceId);
      // 从store中删除RSS源
      removeRSSSource(sourceId);
      toast.success('RSS源已删除');
    }
  };
  
  const handleTestConnection = async (sourceId: string, url: string) => {
    setIsTestingConnection(sourceId);
    try {
      const isValid = await rssService.testRSSConnection(url);
      if (isValid) {
        updateRSSSource(sourceId, { status: 'active' });
        toast.success('连接测试成功');
      } else {
        updateRSSSource(sourceId, { status: 'error' });
        toast.error('连接测试失败');
      }
    } catch (error) {
      updateRSSSource(sourceId, { status: 'error' });
      toast.error('连接测试失败');
    } finally {
      setIsTestingConnection(null);
    }
  };
  
  const handleExportData = () => {
    const data = {
      rssSources,
      tvShows,
      exportTime: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rss-monitor-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('数据导出成功');
  };
  
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.rssSources && Array.isArray(data.rssSources)) {
          data.rssSources.forEach((source: any) => {
            addRSSSource({
              name: source.name + ' (导入)',
              url: source.url,
              status: 'inactive',
              lastUpdate: new Date().toISOString(),
              updateInterval: source.updateInterval || 30,
            });
          });
          toast.success('数据导入成功');
        } else {
          toast.error('导入文件格式不正确');
        }
      } catch (error) {
        toast.error('导入文件解析失败');
      }
    };
    reader.readAsText(file);
    
    // 清空input值，允许重复选择同一文件
    event.target.value = '';
  };
  
  const handleClearData = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      // 清空所有RSS源
      rssSources.forEach(source => removeRSSSource(source.id));
      toast.success('数据已清空');
    }
  };
  
  const handleToggleAutoRefresh = (enabled: boolean) => {
    autoRefreshManager.toggleAutoRefresh(enabled);
    toast.success(enabled ? '自动刷新已启用' : '自动刷新已禁用');
  };
  
  const handleClearNotificationHistory = () => {
    if (window.confirm('确定要清空通知历史吗？这将允许重新发送之前已通知过的剧名。')) {
      clearNotifiedShows();
      autoRefreshManager.clearNotificationHistory();
      toast.success('通知历史已清空');
    }
  };

  const handleTMDBSettingsChange = (field: keyof typeof tmdbSettings, value: any) => {
    updateTMDBSettings({ ...tmdbSettings, [field]: value });
  };

  const handleTestTMDBConnection = async () => {
    if (!tmdbSettings.apiKey.trim()) {
      toast.error('请先输入TMDB API Key');
      return;
    }

    setIsTestingTMDB(true);
    try {
      tmdbService.setConfig({ apiKey: tmdbSettings.apiKey, enabled: true });
      const isValid = await tmdbService.testConnection();
      
      if (isValid) {
        toast.success('TMDB连接测试成功');
      } else {
        toast.error('TMDB连接测试失败，请检查API Key是否正确');
      }
    } catch (error) {
      toast.error('TMDB连接测试失败');
    } finally {
      setIsTestingTMDB(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统配置</h1>
        <p className="mt-1 text-sm text-gray-600">
          管理RSS源配置、数据备份和系统设置
        </p>
      </div>
      
      {/* RSS源配置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            RSS源配置
          </h3>
          
          <div className="space-y-4">
            {rssSources.length === 0 ? (
              <div className="text-center py-8">
                <SettingsIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无RSS源</h3>
                <p className="mt-1 text-sm text-gray-500">
                  请在仪表板页面添加RSS源开始监控
                </p>
              </div>
            ) : (
              rssSources.map((source) => (
                <div
                  key={source.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  {editingSource === source.id ? (
                    // 编辑模式
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            RSS源名称
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            更新间隔（分钟）
                          </label>
                          <input
                            type="number"
                            min="5"
                            max="1440"
                            value={editForm.updateInterval}
                            onChange={(e) => setEditForm({ ...editForm, updateInterval: parseInt(e.target.value) || 30 })}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          RSS URL
                        </label>
                        <input
                          type="url"
                          value={editForm.url}
                          onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <X className="w-4 h-4 mr-1 inline" />
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={isTestingConnection === editingSource}
                          className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className={cn(
                            'w-4 h-4 mr-1 inline',
                            isTestingConnection === editingSource && 'animate-spin'
                          )} />
                          {isTestingConnection === editingSource ? '测试中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 显示模式
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {source.name}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
                          {source.url}
                        </p>
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <span>更新间隔: {source.updateInterval}分钟</span>
                          <span className="mx-2">•</span>
                          <span>状态: {source.status === 'active' ? '正常' : source.status === 'error' ? '错误' : '未知'}</span>
                          <span className="mx-2">•</span>
                          <span>最后更新: {new Date(source.lastUpdate).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTestConnection(source.id, source.url)}
                          disabled={isTestingConnection === source.id}
                          className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                          title="测试连接"
                        >
                          <RefreshCw className={cn(
                            'w-4 h-4',
                            isTestingConnection === source.id && 'animate-spin'
                          )} />
                        </button>
                        <button
                          onClick={() => handleEditSource(source)}
                          className="p-2 text-gray-400 hover:text-blue-600"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id, source.name)}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 自动刷新设置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            自动刷新设置
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">启用自动刷新</h4>
                <p className="text-sm text-gray-500">
                  根据每个RSS源的更新间隔自动刷新内容
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => handleToggleAutoRefresh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">清空通知历史</h4>
                  <p className="text-sm text-gray-500">
                    清空已通知的剧名记录，允许重新发送通知
                  </p>
                </div>
                <button
                  onClick={handleClearNotificationHistory}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  清空历史
                </button>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">调试工具</h4>
                  <p className="text-sm text-gray-500">
                    检查定时器状态和强制重启自动刷新
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const status = autoRefreshManager.getTimerStatus();
                      toast.success(`定时器状态已记录到日志，活跃定时器: ${status.activeTimers}/${status.totalSources}`);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    检查状态
                  </button>
                  <button
                    onClick={() => {
                      autoRefreshManager.forceRestartAllTimers();
                      toast.success('已强制重启所有定时器');
                    }}
                    className="px-3 py-2 border border-orange-300 rounded-md text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
                  >
                    重启定时器
                  </button>
                </div>
              </div>
            </div>
            
            {autoRefreshEnabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <RefreshCw className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      自动刷新已启用
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        系统将根据每个RSS源的更新间隔自动刷新内容。
                        您可以在RSS源配置中调整每个源的更新间隔。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* TMDB配置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            TMDB配置
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">启用TMDB集成</h4>
                <p className="text-sm text-gray-500">
                  自动为没有TMDB链接的剧集搜索链接
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tmdbSettings.enabled}
                  onChange={(e) => handleTMDBSettingsChange('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TMDB API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={tmdbSettings.apiKey}
                    onChange={(e) => handleTMDBSettingsChange('apiKey', e.target.value)}
                    placeholder="请输入TMDB API Key"
                    className="block w-full pr-20 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleTestTMDBConnection}
                      disabled={isTestingTMDB || !tmdbSettings.apiKey.trim()}
                      className="ml-1 mr-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTestingTMDB ? '测试中...' : '测试'}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  获取API Key: <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">TMDB API设置页面</a>
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">自动搜索缺失链接</h4>
                  <p className="text-sm text-gray-500">
                    在RSS刷新时自动为没有TMDB链接的剧集搜索链接
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                     type="checkbox"
                     checked={tmdbSettings.autoSearch}
                     onChange={(e) => handleTMDBSettingsChange('autoSearch', e.target.checked)}
                     disabled={!tmdbSettings.enabled}
                     className="sr-only peer"
                   />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            </div>
            
            {tmdbSettings.enabled && tmdbSettings.apiKey && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Key className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      TMDB集成已启用
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        系统将自动为没有TMDB链接的剧集搜索相关信息。
                        搜索将优先使用中文标题，然后是英文标题。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {tmdbSettings.enabled && !tmdbSettings.apiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Key className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      需要配置API Key
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        请输入有效的TMDB API Key以启用自动搜索功能。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 数据管理 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            数据管理
          </h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Download className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <h4 className="text-sm font-medium text-gray-900 mb-2">导出数据</h4>
              <p className="text-xs text-gray-500 mb-3">
                导出所有RSS源和剧名数据
              </p>
              <button
                onClick={handleExportData}
                className="w-full px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                导出
              </button>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Upload className="mx-auto h-8 w-8 text-green-500 mb-2" />
              <h4 className="text-sm font-medium text-gray-900 mb-2">导入数据</h4>
              <p className="text-xs text-gray-500 mb-3">
                从备份文件导入RSS源配置
              </p>
              <label className="w-full px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 cursor-pointer inline-block">
                导入
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Trash2 className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <h4 className="text-sm font-medium text-gray-900 mb-2">清空数据</h4>
              <p className="text-xs text-gray-500 mb-3">
                清空所有RSS源和剧名数据
              </p>
              <button
                onClick={handleClearData}
                className="w-full px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                清空
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 系统信息 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            系统信息
          </h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">RSS源数量</dt>
              <dd className="mt-1 text-sm text-gray-900">{rssSources.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">剧名数量</dt>
              <dd className="mt-1 text-sm text-gray-900">{tvShows.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">活跃RSS源</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {rssSources.filter(s => s.status === 'active').length}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">新剧名</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {tvShows.filter(s => s.isNew).length}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;