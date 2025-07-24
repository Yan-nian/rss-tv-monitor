import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, MessageSquare, Hash } from 'lucide-react';
import useStore from '../store';
import { notificationService } from '../services/notificationService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const Notifications: React.FC = () => {
  const { notificationConfig, updateNotificationConfig } = useStore();
  const [isTesting, setIsTesting] = useState<'telegram' | 'discord' | null>(null);
  const [formData, setFormData] = useState(notificationConfig);
  
  const handleInputChange = (platform: 'telegram' | 'discord', field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };
  
  const handleMessageTemplateChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      messageTemplate: value,
    }));
  };
  
  const handleSave = () => {
    updateNotificationConfig(formData);
    toast.success('通知设置已保存');
  };
  
  const handleTestTelegram = async () => {
    const errors = notificationService.validateTelegramConfig(formData.telegram);
    if (errors.length > 0) {
      toast.error(`配置错误: ${errors.join(', ')}`);
      return;
    }
    
    setIsTesting('telegram');
    try {
      const result = await notificationService.testTelegramConnection(formData.telegram);
      if (result.success) {
        toast.success('Telegram测试消息发送成功！');
      } else {
        toast.error(`Telegram测试失败: ${result.error}`);
      }
    } catch (error) {
      toast.error('Telegram测试失败');
    } finally {
      setIsTesting(null);
    }
  };
  
  const handleTestDiscord = async () => {
    const errors = notificationService.validateDiscordConfig(formData.discord);
    if (errors.length > 0) {
      toast.error(`配置错误: ${errors.join(', ')}`);
      return;
    }
    
    setIsTesting('discord');
    try {
      const result = await notificationService.testDiscordConnection(formData.discord);
      if (result.success) {
        toast.success('Discord测试消息发送成功！');
      } else {
        toast.error(`Discord测试失败: ${result.error}`);
      }
    } catch (error) {
      toast.error('Discord测试失败');
    } finally {
      setIsTesting(null);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">通知设置</h1>
        <p className="mt-1 text-sm text-gray-600">
          配置Telegram和Discord通知，当发现新剧名时自动发送通知
        </p>
      </div>
      
      {/* Telegram配置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <MessageSquare className="h-6 w-6 text-blue-500 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Telegram通知
              </h3>
            </div>
            <div className="flex items-center">
              <input
                id="telegram-enabled"
                type="checkbox"
                checked={formData.telegram.enabled}
                onChange={(e) => handleInputChange('telegram', 'enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="telegram-enabled" className="ml-2 block text-sm text-gray-900">
                启用
              </label>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="telegram-bot-token" className="block text-sm font-medium text-gray-700">
                Bot Token
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  id="telegram-bot-token"
                  value={formData.telegram.botToken}
                  onChange={(e) => handleInputChange('telegram', 'botToken', e.target.value)}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  disabled={!formData.telegram.enabled}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                从 @BotFather 获取的Bot Token
              </p>
            </div>
            
            <div>
              <label htmlFor="telegram-chat-id" className="block text-sm font-medium text-gray-700">
                Chat ID
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="telegram-chat-id"
                  value={formData.telegram.chatId}
                  onChange={(e) => handleInputChange('telegram', 'chatId', e.target.value)}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="-1001234567890"
                  disabled={!formData.telegram.enabled}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                接收通知的聊天ID（个人或群组）
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleTestTelegram}
              disabled={!formData.telegram.enabled || isTesting === 'telegram'}
              className={cn(
                'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white',
                formData.telegram.enabled
                  ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  : 'bg-gray-400 cursor-not-allowed'
              )}
            >
              <Send className={cn(
                'w-4 h-4 mr-2',
                isTesting === 'telegram' && 'animate-pulse'
              )} />
              {isTesting === 'telegram' ? '发送中...' : '发送测试消息'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Discord配置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Hash className="h-6 w-6 text-indigo-500 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Discord通知
              </h3>
            </div>
            <div className="flex items-center">
              <input
                id="discord-enabled"
                type="checkbox"
                checked={formData.discord.enabled}
                onChange={(e) => handleInputChange('discord', 'enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="discord-enabled" className="ml-2 block text-sm text-gray-900">
                启用
              </label>
            </div>
          </div>
          
          <div>
            <label htmlFor="discord-webhook-url" className="block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            <div className="mt-1">
              <input
                type="url"
                id="discord-webhook-url"
                value={formData.discord.webhookUrl}
                onChange={(e) => handleInputChange('discord', 'webhookUrl', e.target.value)}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="https://discord.com/api/webhooks/..."
                disabled={!formData.discord.enabled}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Discord频道的Webhook URL
            </p>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleTestDiscord}
              disabled={!formData.discord.enabled || isTesting === 'discord'}
              className={cn(
                'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white',
                formData.discord.enabled
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  : 'bg-gray-400 cursor-not-allowed'
              )}
            >
              <Send className={cn(
                'w-4 h-4 mr-2',
                isTesting === 'discord' && 'animate-pulse'
              )} />
              {isTesting === 'discord' ? '发送中...' : '发送测试消息'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 消息模板配置 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            消息模板
          </h3>
          
          <div>
            <label htmlFor="message-template" className="block text-sm font-medium text-gray-700">
              通知消息模板
            </label>
            <div className="mt-1">
              <textarea
                id="message-template"
                rows={3}
                value={formData.messageTemplate}
                onChange={(e) => handleMessageTemplateChange(e.target.value)}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="🎬 发现新剧集: {{title}}"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              可用变量: &#123;&#123;title&#125;&#125; - 剧名, &#123;&#123;chineseTitle&#125;&#125; - 中文名, &#123;&#123;category&#125;&#125; - 分类, &#123;&#123;link&#125;&#125; - 链接, &#123;&#123;firstSeen&#125;&#125; - 发现时间, &#123;&#123;count&#125;&#125; - 出现次数
            </p>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">预览效果:</h4>
            <div className="text-sm text-gray-700">
              {formData.messageTemplate
                .replace(/{{title}}/g, '示例剧名')
                .replace(/{{chineseTitle}}/g, '示例中文名')
                .replace(/{{category}}/g, '剧集')
                .replace(/{{link}}/g, 'https://example.com')
                .replace(/{{firstSeen}}/g, new Date().toLocaleString('zh-CN'))
                .replace(/{{count}}/g, '1')
              }
            </div>
          </div>
        </div>
      </div>
      
      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          保存设置
        </button>
      </div>
      
      {/* 帮助信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              配置帮助
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Telegram: 需要先创建Bot并获取Token，然后获取Chat ID</li>
                <li>Discord: 在频道设置中创建Webhook并复制URL</li>
                <li>建议先测试连接确保配置正确</li>
                <li>消息模板支持多种变量，可以自定义通知内容</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;