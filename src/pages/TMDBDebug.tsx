import React, { useState, useEffect } from 'react';
import { Search, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import useStore from '../store';
import { tmdbService } from '../services/tmdbService';
import { toast } from 'sonner';

interface TestResult {
  query: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
}

const TMDBDebug: React.FC = () => {
  const { tmdbSettings } = useStore();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>('unknown');
  const [testQuery, setTestQuery] = useState('The Bear');
  const [chineseQuery, setChineseQuery] = useState('熊家餐厅');
  const [isSearching, setIsSearching] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [configStatus, setConfigStatus] = useState<any>(null);

  useEffect(() => {
    // 检查配置状态
    setConfigStatus({
      hasApiKey: !!tmdbSettings.apiKey,
      enabled: tmdbSettings.enabled,
      autoSearch: tmdbSettings.autoSearch,
      apiKeyLength: tmdbSettings.apiKey?.length || 0
    });
  }, [tmdbSettings]);

  const testConnection = async () => {
    if (!tmdbSettings.apiKey) {
      toast.error('请先在设置页面配置TMDB API Key');
      return;
    }

    setIsTestingConnection(true);
    try {
      tmdbService.setConfig({
        apiKey: tmdbSettings.apiKey,
        enabled: true,
        proxy: tmdbSettings.proxy
      });
      
      const isValid = await tmdbService.testConnection();
      setConnectionStatus(isValid ? 'success' : 'failed');
      
      if (isValid) {
        toast.success('TMDB连接测试成功');
      } else {
        toast.error('TMDB连接测试失败');
      }
    } catch (error) {
      setConnectionStatus('failed');
      toast.error('连接测试出错: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testSearch = async () => {
    if (!tmdbSettings.apiKey) {
      toast.error('请先配置TMDB API Key');
      return;
    }

    setIsSearching(true);
    const startTime = Date.now();
    
    try {
      tmdbService.setConfig({
        apiKey: tmdbSettings.apiKey,
        enabled: true,
        proxy: tmdbSettings.proxy
      });
      
      const result = await tmdbService.smartSearch(testQuery, chineseQuery);
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        query: `${testQuery}${chineseQuery ? ` / ${chineseQuery}` : ''}`,
        success: !!result,
        result: result || undefined,
        duration
      };
      
      setTestResults(prev => [testResult, ...prev.slice(0, 9)]); // 保留最近10次测试
      
      if (result) {
        toast.success(`搜索成功: ${result}`);
      } else {
        toast.warning('未找到匹配的TMDB链接');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        query: `${testQuery}${chineseQuery ? ` / ${chineseQuery}` : ''}`,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        duration
      };
      
      setTestResults(prev => [testResult, ...prev.slice(0, 9)]);
      toast.error('搜索失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsSearching(false);
    }
  };

  const runBatchTest = async () => {
    const testCases = [
      { title: 'The Bear', chinese: '熊家餐厅' },
      { title: 'Wednesday', chinese: '星期三' },
      { title: 'House of the Dragon', chinese: '龙之家族' },
      { title: 'Stranger Things', chinese: '怪奇物语' },
      { title: 'The Last of Us', chinese: '最后生还者' }
    ];

    setIsSearching(true);
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      
      try {
        const result = await tmdbService.smartSearch(testCase.title, testCase.chinese);
        const duration = Date.now() - startTime;
        
        const testResult: TestResult = {
          query: `${testCase.title} / ${testCase.chinese}`,
          success: !!result,
          result: result || undefined,
          duration
        };
        
        setTestResults(prev => [testResult, ...prev]);
        
        // 避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const duration = Date.now() - startTime;
        const testResult: TestResult = {
          query: `${testCase.title} / ${testCase.chinese}`,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          duration
        };
        
        setTestResults(prev => [testResult, ...prev]);
      }
    }
    
    setIsSearching(false);
    toast.success('批量测试完成');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            TMDB调试工具
          </h3>
          
          {/* 配置状态 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              配置状态
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                {configStatus?.hasApiKey ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mr-2" />
                )}
                <span>API Key: {configStatus?.hasApiKey ? `已配置 (${configStatus.apiKeyLength}字符)` : '未配置'}</span>
              </div>
              <div className="flex items-center">
                {configStatus?.enabled ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mr-2" />
                )}
                <span>TMDB集成: {configStatus?.enabled ? '已启用' : '未启用'}</span>
              </div>
              <div className="flex items-center">
                {configStatus?.autoSearch ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mr-2" />
                )}
                <span>自动搜索: {configStatus?.autoSearch ? '已启用' : '未启用'}</span>
              </div>
              <div className="flex items-center">
                {connectionStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : connectionStatus === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-500 mr-2" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500 mr-2" />
                )}
                <span>连接状态: {
                  connectionStatus === 'success' ? '正常' :
                  connectionStatus === 'failed' ? '失败' : '未测试'
                }</span>
              </div>
            </div>
          </div>

          {/* 连接测试 */}
          <div className="mb-6">
            <button
              onClick={testConnection}
              disabled={isTestingConnection || !configStatus?.hasApiKey}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingConnection ? '测试中...' : '测试TMDB连接'}
            </button>
          </div>

          {/* 搜索测试 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              <Search className="w-4 h-4 mr-2" />
              搜索测试
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  英文标题
                </label>
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="输入英文标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  中文标题
                </label>
                <input
                  type="text"
                  value={chineseQuery}
                  onChange={(e) => setChineseQuery(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="输入中文标题"
                />
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={testSearch}
                disabled={isSearching || !configStatus?.hasApiKey || !testQuery}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? '搜索中...' : '测试搜索'}
              </button>
              
              <button
                onClick={runBatchTest}
                disabled={isSearching || !configStatus?.hasApiKey}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                批量测试
              </button>
            </div>
          </div>

          {/* 测试结果 */}
          {testResults.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                测试结果
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mr-2" />
                          )}
                          <span className="text-sm font-medium">{result.query}</span>
                        </div>
                        {result.result && (
                          <div className="mt-1">
                            <a
                              href={result.result}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800 underline"
                            >
                              {result.result}
                            </a>
                          </div>
                        )}
                        {result.error && (
                          <div className="mt-1 text-sm text-red-600">
                            错误: {result.error}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {result.duration}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TMDBDebug;