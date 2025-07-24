# RSS影视剧监控工具

一个基于React和Docker的RSS信息统计工具，专门用于监控影视剧资源更新并提供智能通知服务。

## 功能特性

- 🎬 **RSS源管理**: 添加、编辑、删除RSS源链接，支持多个RSS源同时监控
- 📊 **剧名统计**: 自动提取和统计影视剧名称，支持搜索和分类
- 🔔 **智能通知**: 支持Telegram和Discord通知，发现新剧名时自动推送
- 📱 **响应式设计**: 支持桌面端和移动端访问
- 🐳 **Docker部署**: 基于Docker容器化，易于部署和管理
- 💾 **数据持久化**: 支持数据导入导出和备份

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router
- **构建工具**: Vite
- **部署**: Docker + Nginx

## 快速开始

### 使用Docker部署（推荐）

1. 克隆项目
```bash
git clone https://github.com/Yan-nian/rss-tv-monitor.git
cd rss-tv-monitor
```

2. 使用Docker Compose启动
```bash
docker-compose up -d
```

3. 访问应用
打开浏览器访问 `http://localhost:3000`

### 本地开发

1. 安装依赖
```bash
pnpm install
```

2. 启动开发服务器
```bash
pnpm dev
```

3. 构建生产版本
```bash
pnpm build
```

## 使用指南

### 1. 添加RSS源

1. 进入「仪表板」页面
2. 点击「添加RSS源」按钮
3. 填写RSS源名称和URL
4. 系统会自动测试连接并开始监控

### 2. 配置通知

#### Telegram通知
1. 创建Telegram Bot：
   - 联系 @BotFather 创建新的Bot
   - 获取Bot Token
2. 获取Chat ID：
   - 将Bot添加到群组或私聊
   - 发送消息给Bot
   - 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` 获取Chat ID
3. 在「通知设置」页面配置Token和Chat ID

#### Discord通知
1. 在Discord频道设置中创建Webhook
2. 复制Webhook URL
3. 在「通知设置」页面配置Webhook URL

### 3. 查看统计

- 「仪表板」：查看总体统计和RSS源状态
- 「剧名统计」：查看详细的剧名列表，支持搜索和过滤
- 「系统配置」：管理RSS源和数据备份

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | production |

### 数据存储

应用使用浏览器的localStorage进行数据持久化，支持：
- RSS源配置
- 剧名数据
- 通知设置
- 数据导入导出

## 开发指南

### 项目结构

```
src/
├── components/          # 公共组件
│   └── Layout.tsx      # 布局组件
├── pages/              # 页面组件
│   ├── Dashboard.tsx   # 仪表板
│   ├── Shows.tsx       # 剧名统计
│   ├── Notifications.tsx # 通知设置
│   └── Settings.tsx    # 系统配置
├── services/           # 服务层
│   ├── rssService.ts   # RSS解析服务
│   └── notificationService.ts # 通知服务
├── store/              # 状态管理
│   └── index.ts        # Zustand store
└── lib/                # 工具函数
    └── utils.ts
```

### 添加新功能

1. 在对应目录创建组件或服务
2. 更新store状态管理
3. 添加路由（如需要）
4. 更新类型定义

## 部署

### Docker部署

```bash
# 构建镜像
docker build -t rss-monitor .

# 运行容器
docker run -d -p 3000:80 --name rss-monitor rss-monitor
```

### 使用Docker Compose

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 常见问题

### Q: RSS源连接失败怎么办？
A: 检查RSS URL是否正确，某些RSS源可能需要特殊的访问权限或参数。

### Q: 通知发送失败？
A: 检查Telegram Bot Token和Chat ID，或Discord Webhook URL是否正确配置。

### Q: 如何备份数据？
A: 在「系统配置」页面使用导出功能，定期备份配置和数据。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License
