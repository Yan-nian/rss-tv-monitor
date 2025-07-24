import axios from 'axios';
import { NotificationConfig, TVShow } from '../store';
import { logService } from './logService';

class NotificationService {
  async sendTelegramNotification(
    config: NotificationConfig['telegram'],
    message: string
  ): Promise<boolean> {
    if (!config.enabled || !config.botToken || !config.chatId) {
      logService.log('info', 'notification', 'Telegram通知跳过：配置不完整');
      return false;
    }
    
    try {
      logService.log('info', 'notification', `发送Telegram通知到聊天: ${config.chatId}`);
      
      const response = await axios.post('/api/notifications/telegram/send', {
        botToken: config.botToken,
        chatId: config.chatId,
        message: message,
      });
      
      if (response.data.success) {
        logService.log('success', 'notification', 'Telegram通知发送成功', {
          chatId: config.chatId,
          messageLength: message.length
        });
        return true;
      } else {
        const error = response.data.error || 'Telegram发送失败';
        logService.log('error', 'notification', `Telegram通知发送失败: ${error}`, {
          chatId: config.chatId,
          error
        });
        throw new Error(error);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Telegram API调用失败';
      logService.log('error', 'notification', `Telegram通知异常: ${errorMessage}`, {
        chatId: config.chatId,
        error: errorMessage,
        status: error.response?.status
      });
      
      // 抛出错误以便上层处理
      throw new Error(errorMessage);
    }
  }
  
  async sendDiscordNotification(
    config: NotificationConfig['discord'],
    message: string
  ): Promise<boolean> {
    if (!config.enabled || !config.botToken || !config.channelId) {
      logService.log('info', 'notification', 'Discord通知跳过：配置不完整');
      return false;
    }
    
    try {
      logService.log('info', 'notification', `发送Discord通知到频道: ${config.channelId}`);
      
      const response = await axios.post('/api/notifications/discord/send', {
        botToken: config.botToken,
        channelId: config.channelId,
        message: message,
      });
      
      if (response.data.success) {
        logService.log('success', 'notification', 'Discord通知发送成功', {
          channelId: config.channelId,
          messageLength: message.length
        });
        return true;
      } else {
        const error = response.data.error || 'Discord发送失败';
        logService.log('error', 'notification', `Discord通知发送失败: ${error}`, {
          channelId: config.channelId,
          error
        });
        throw new Error(error);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Discord API调用失败';
      logService.log('error', 'notification', `Discord通知异常: ${errorMessage}`, {
        channelId: config.channelId,
        error: errorMessage,
        status: error.response?.status
      });
      
      // 抛出错误以便上层处理
      throw new Error(errorMessage);
    }
  }
  
  async sendNewShowNotification(
    notificationConfig: NotificationConfig,
    shows: TVShow[]
  ): Promise<void> {
    if (shows.length === 0) return;
    
    logService.log('info', 'notification', `准备发送新剧集通知，共 ${shows.length} 部剧集`, {
      showCount: shows.length,
      showTitles: shows.map(s => s.title),
      telegramEnabled: notificationConfig.telegram.enabled,
      discordEnabled: notificationConfig.discord.enabled
    });
    
    const messages = shows.map(show => 
      this.formatMessage(notificationConfig.messageTemplate, show)
    );
    
    const combinedMessage = messages.join('\n');
    
    // 发送Telegram通知
    if (notificationConfig.telegram.enabled) {
      try {
        await this.sendTelegramNotification(
          notificationConfig.telegram,
          combinedMessage
        );
        logService.log('success', 'notification', 'Telegram新剧集通知发送成功', {
          showCount: shows.length,
          messageLength: combinedMessage.length
        });
      } catch (error) {
        logService.log('error', 'notification', 'Telegram新剧集通知发送失败', {
          showCount: shows.length,
          error: error instanceof Error ? error.message : String(error)
        });
        // 不阻断其他通知的发送
      }
    }
    
    // 发送Discord通知
    if (notificationConfig.discord.enabled) {
      try {
        await this.sendDiscordNotification(
          notificationConfig.discord,
          combinedMessage
        );
        logService.log('success', 'notification', 'Discord新剧集通知发送成功', {
          showCount: shows.length,
          messageLength: combinedMessage.length
        });
      } catch (error) {
        logService.log('error', 'notification', 'Discord新剧集通知发送失败', {
          showCount: shows.length,
          error: error instanceof Error ? error.message : String(error)
        });
        // 不阻断其他通知的发送
      }
    }
  }
  
  private formatMessage(template: string, show: TVShow): string {
    return template
      .replace(/{{title}}/g, show.title)
      .replace(/{{chineseTitle}}/g, show.chineseTitle || show.title)
      .replace(/{{link}}/g, show.tmdbLink || '')
      .replace(/{{category}}/g, show.category || '未分类')
      .replace(/{{firstSeen}}/g, new Date(show.firstSeen).toLocaleString('zh-CN'))
      .replace(/{{count}}/g, show.count.toString())
      .replace(/{{torrentLink}}/g, show.torrentLink || '')
      .replace(/{{pubDate}}/g, show.pubDate ? new Date(show.pubDate).toLocaleString('zh-CN') : '');
  }
  
  async testTelegramConnection(
    config: NotificationConfig['telegram']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logService.log('info', 'notification', '测试Telegram连接...', {
        chatId: config.chatId
      });
      
      const response = await axios.post('/api/notifications/telegram/test', {
        botToken: config.botToken,
        chatId: config.chatId,
      });
      
      if (response.data.success) {
        logService.log('success', 'notification', 'Telegram连接测试成功', {
          chatId: config.chatId
        });
        return { success: true };
      } else {
        const error = response.data.error || '测试失败';
        logService.log('error', 'notification', `Telegram连接测试失败: ${error}`, {
          chatId: config.chatId,
          error
        });
        return {
          success: false,
          error,
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '连接测试失败';
      logService.log('error', 'notification', `Telegram连接测试异常: ${errorMessage}`, {
        chatId: config.chatId,
        error: errorMessage,
        status: error.response?.status
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  async testDiscordConnection(
    config: NotificationConfig['discord']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logService.log('info', 'notification', '测试Discord连接...', {
        channelId: config.channelId
      });
      
      const response = await axios.post('/api/notifications/discord/test', {
        botToken: config.botToken,
        channelId: config.channelId,
      });
      
      if (response.data.success) {
        logService.log('success', 'notification', 'Discord连接测试成功', {
          channelId: config.channelId
        });
        return { success: true };
      } else {
        const error = response.data.error || '测试失败';
        logService.log('error', 'notification', `Discord连接测试失败: ${error}`, {
          channelId: config.channelId,
          error
        });
        return {
          success: false,
          error,
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '连接测试失败';
      logService.log('error', 'notification', `Discord连接测试异常: ${errorMessage}`, {
        channelId: config.channelId,
        error: errorMessage,
        status: error.response?.status
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  validateTelegramConfig(config: NotificationConfig['telegram']): string[] {
    const errors: string[] = [];
    
    if (!config.botToken) {
      errors.push('Bot Token不能为空');
    } else if (!config.botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      errors.push('Bot Token格式不正确');
    }
    
    if (!config.chatId) {
      errors.push('Chat ID不能为空');
    } else if (!config.chatId.match(/^-?\d+$/)) {
      errors.push('Chat ID必须是数字');
    }
    
    return errors;
  }
  
  validateDiscordConfig(config: NotificationConfig['discord']): string[] {
    const errors: string[] = [];
    
    if (!config.botToken) {
      errors.push('Bot Token不能为空');
    } else if (config.botToken.length < 50) {
      errors.push('Bot Token长度不正确，请检查是否完整');
    }
    
    if (!config.channelId) {
      errors.push('Channel ID不能为空');
    } else if (!config.channelId.match(/^\d{17,20}$/)) {
      errors.push('Channel ID格式不正确，应为17-20位数字');
    }
    
    return errors;
  }
}

export const notificationService = new NotificationService();
export default notificationService;