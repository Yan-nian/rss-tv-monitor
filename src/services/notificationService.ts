import axios from 'axios';
import { NotificationConfig, TVShow } from '../store';

class NotificationService {
  async sendTelegramNotification(
    config: NotificationConfig['telegram'],
    message: string
  ): Promise<boolean> {
    if (!config.enabled || !config.botToken || !config.chatId) {
      return false;
    }
    
    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
      });
      return true;
    } catch (error) {
      console.error('Telegram notification failed:', error);
      return false;
    }
  }
  
  async sendDiscordNotification(
    config: NotificationConfig['discord'],
    message: string
  ): Promise<boolean> {
    if (!config.enabled || !config.webhookUrl) {
      return false;
    }
    
    try {
      await axios.post(config.webhookUrl, {
        content: message,
        username: 'RSS Monitor',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
      });
      return true;
    } catch (error) {
      console.error('Discord notification failed:', error);
      return false;
    }
  }
  
  async sendNewShowNotification(
    notificationConfig: NotificationConfig,
    shows: TVShow[]
  ): Promise<void> {
    if (shows.length === 0) return;
    
    const messages = shows.map(show => 
      this.formatMessage(notificationConfig.messageTemplate, show)
    );
    
    const combinedMessage = messages.join('\n');
    
    // 发送Telegram通知
    if (notificationConfig.telegram.enabled) {
      await this.sendTelegramNotification(
        notificationConfig.telegram,
        combinedMessage
      );
    }
    
    // 发送Discord通知
    if (notificationConfig.discord.enabled) {
      await this.sendDiscordNotification(
        notificationConfig.discord,
        combinedMessage
      );
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
      const success = await this.sendTelegramNotification(
        config,
        '🧪 RSS监控工具测试消息'
      );
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
  
  async testDiscordConnection(
    config: NotificationConfig['discord']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const success = await this.sendDiscordNotification(
        config,
        '🧪 RSS监控工具测试消息'
      );
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
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
    
    if (!config.webhookUrl) {
      errors.push('Webhook URL不能为空');
    } else if (!config.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      errors.push('Webhook URL格式不正确');
    }
    
    return errors;
  }
}

export const notificationService = new NotificationService();
export default notificationService;