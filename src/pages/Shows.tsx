import React, { useState, useMemo } from 'react';
import { Search, Filter, Eye, EyeOff, Calendar, Hash, ExternalLink, Trash2, Rss, Download } from 'lucide-react';
import useStore from '../store';
import { cn } from '../lib/utils';

const Shows: React.FC = () => {
  const { tvShows, markAsRead, removeTVShow, clearAllTVShows } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'firstSeen' | 'count'>('firstSeen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 获取所有分类
  const categories = useMemo(() => {
    const cats = new Set(tvShows.map(show => show.category || '其他'));
    return Array.from(cats).sort();
  }, [tvShows]);
  
  // 过滤和排序剧名
  const filteredShows = useMemo(() => {
    let filtered = tvShows.filter(show => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = show.title.toLowerCase().includes(searchLower) || 
                           (show.chineseTitle && show.chineseTitle.toLowerCase().includes(searchLower));
      const matchesCategory = selectedCategory === 'all' || show.category === selectedCategory;
      const matchesNewFilter = !showOnlyNew || show.isNew;
      
      return matchesSearch && matchesCategory && matchesNewFilter;
    });
    
    // 排序
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'firstSeen':
          aValue = new Date(a.firstSeen).getTime();
          bValue = new Date(b.firstSeen).getTime();
          break;
        case 'count':
          aValue = a.count;
          bValue = b.count;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [tvShows, searchTerm, selectedCategory, showOnlyNew, sortBy, sortOrder]);
  
  const handleSort = (field: 'title' | 'firstSeen' | 'count') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  const handleMarkAsRead = (showId: string) => {
    markAsRead(showId);
  };

  const handleDeleteShow = (showId: string, showTitle: string) => {
    if (window.confirm(`确定要删除剧名 "${showTitle}" 吗？此操作不可撤销。`)) {
      removeTVShow(showId);
    }
  };

  const handleClearAllShows = () => {
    if (window.confirm(`确定要删除所有剧名记录吗？此操作不可撤销，将清空 ${tvShows.length} 条记录。`)) {
      clearAllTVShows();
    }
  };
  
  const getSortIcon = (field: 'title' | 'firstSeen' | 'count') => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">剧名统计</h1>
          <p className="mt-1 text-sm text-gray-600">
            管理和查看已发现的影视剧名称
          </p>
        </div>
        {tvShows.length > 0 && (
          <button
            onClick={handleClearAllShows}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清空所有记录
          </button>
        )}
      </div>
      
      {/* 搜索和过滤器 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 搜索框 */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="搜索剧名（支持中英文）..."
            />
          </div>
          
          {/* 分类过滤 */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">所有分类</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          
          {/* 新剧名过滤 */}
          <div className="flex items-center">
            <input
              id="show-only-new"
              type="checkbox"
              checked={showOnlyNew}
              onChange={(e) => setShowOnlyNew(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="show-only-new" className="ml-2 block text-sm text-gray-900">
              仅显示新剧名
            </label>
          </div>
          
          {/* 统计信息 */}
          <div className="flex items-center text-sm text-gray-600">
            <Filter className="h-4 w-4 mr-1" />
            显示 {filteredShows.length} / {tvShows.length} 个剧名
          </div>
        </div>
      </div>
      
      {/* 剧名列表 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center space-x-1">
                    <span>剧名</span>
                    <span className="text-gray-400">{getSortIcon('title')}</span>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  中文名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  详情链接
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <Rss className="h-4 w-4" />
                    <span>RSS源</span>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发布日期
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  种子链接
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('firstSeen')}
                >
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>首次发现</span>
                    <span className="text-gray-400">{getSortIcon('firstSeen')}</span>
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('count')}
                >
                  <div className="flex items-center space-x-1">
                    <Hash className="h-4 w-4" />
                    <span>出现次数</span>
                    <span className="text-gray-400">{getSortIcon('count')}</span>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredShows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    {tvShows.length === 0 ? '暂无剧名数据' : '没有符合条件的剧名'}
                  </td>
                </tr>
              ) : (
                filteredShows.map((show) => (
                  <tr key={show.id} className={cn(
                    'hover:bg-gray-50',
                    show.isNew && 'bg-blue-50'
                  )}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {show.title}
                          </div>
                          {show.isNew && (
                            <div className="text-xs text-blue-600 font-medium">
                              新发现
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {show.chineseTitle || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {show.category || '其他'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {show.tmdbLink ? (
                        <a
                          href={show.tmdbLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-900"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {show.tmdbLink.includes('themoviedb.org') ? 'TMDB' : 
                           show.tmdbLink.includes('douban.com') ? '豆瓣' : '查看详情'}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {show.sources && show.sources.length > 0 ? (
                          <div className="space-y-1">
                            {show.sources.map((source, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {show.pubDate ? new Date(show.pubDate).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {show.torrentLink ? (
                        <a
                          href={show.torrentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-green-600 hover:text-green-900"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          下载
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(show.firstSeen).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {show.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {show.isNew ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          未读
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          已读
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {show.isNew && (
                          <button
                            onClick={() => handleMarkAsRead(show.id)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <EyeOff className="h-4 w-4 mr-1" />
                            标记已读
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteShow(show.id, show.title)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center"
                          title="删除记录"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 统计摘要 */}
      {filteredShows.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">统计摘要</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredShows.filter(show => show.isNew).length}
              </div>
              <div className="text-sm text-gray-600">未读剧名</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {categories.length}
              </div>
              <div className="text-sm text-gray-600">分类数量</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(filteredShows.reduce((sum, show) => sum + show.count, 0) / filteredShows.length)}
              </div>
              <div className="text-sm text-gray-600">平均出现次数</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shows;