export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'rss' | 'notification' | 'system' | 'tmdb';
  message: string;
  details?: any;
}

class LogService {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最多保存1000条日志
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  private addLog(level: LogEntry['level'], category: LogEntry['category'], message: string, details?: any) {
    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details
    };

    this.logs.unshift(logEntry); // 新日志添加到开头
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // 通知监听器
    this.notifyListeners();

    // 同时输出到控制台
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${category.toUpperCase()}] ${message}`, details || '');
  }

  info(category: LogEntry['category'], message: string, details?: any) {
    this.addLog('info', category, message, details);
  }

  success(category: LogEntry['category'], message: string, details?: any) {
    this.addLog('success', category, message, details);
  }

  warn(category: LogEntry['category'], message: string, details?: any) {
    this.addLog('warn', category, message, details);
  }

  error(category: LogEntry['category'], message: string, details?: any) {
    this.addLog('error', category, message, details);
  }

  // 通用日志方法
  log(level: LogEntry['level'], category: LogEntry['category'], message: string, details?: any) {
    this.addLog(level, category, message, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByCategory(category: LogEntry['category']): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  // 订阅日志更新
  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  // 导出日志
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // 获取统计信息
  getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      total: this.logs.length,
      today: this.logs.filter(log => new Date(log.timestamp) >= today).length,
      errors: this.logs.filter(log => log.level === 'error').length,
      warnings: this.logs.filter(log => log.level === 'warn').length,
      byCategory: {
        rss: this.logs.filter(log => log.category === 'rss').length,
        notification: this.logs.filter(log => log.category === 'notification').length,
        system: this.logs.filter(log => log.category === 'system').length,
        tmdb: this.logs.filter(log => log.category === 'tmdb').length,
      }
    };
  }
}

export const logService = new LogService();

// 初始化时记录系统启动日志
logService.info('system', '系统启动', { timestamp: new Date().toISOString() });