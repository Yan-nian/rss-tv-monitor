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
- **后端**: Node.js + Express
- **状态管理**: Zustand
- **路由**: React Router
- **构建工具**: Vite
- **部署**: Docker + Nginx + GitHub Actions
- **容器注册**: GitHub Container Registry (GHCR)

## 快速开始

### 使用Docker部署（推荐）

#### 方式一：使用预构建镜像（最简单）

1. 下载配置文件
```bash
wget https://raw.githubusercontent.com/Yan-nian/rss-tv-monitor/main/docker-compose.yml
```

2. 启动服务
```bash
docker-compose up -d
```

3. 访问应用
   - 前端界面：http://localhost:3000
   - 后端API：http://localhost:3001

#### 方式二：本地构建

1. 克隆项目
```bash
git clone https://github.com/Yan-nian/rss-tv-monitor.git
cd rss-tv-monitor
```

2. 修改配置使用本地构建
```bash
# 编辑 docker-compose.yml，注释 image 行，取消注释 build 行
sed -i 's/image: ghcr.io/#image: ghcr.io/' docker-compose.yml
sed -i 's/# build: ./build: ./' docker-compose.yml
```

3. 构建并启动
```bash
docker-compose up -d --build
```

> 📖 详细的Docker部署指南请参考 [DOCKER.md](./DOCKER.md)

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
1. 在Discord开发者门户创建Bot应用：
   - 访问 https://discord.com/developers/applications
   - 创建新应用并添加Bot
   - 获取Bot Token
2. 获取频道ID：
   - 在Discord中启用开发者模式
   - 右键点击目标频道，复制ID
3. 将Bot添加到服务器并授予发送消息权限
4. 在「通知设置」页面配置Bot Token和频道ID

### 3. 查看统计

- 「仪表板」：查看总体统计和RSS源状态
- 「剧名统计」：查看详细的剧名列表，支持搜索和过滤
- 「系统配置」：管理RSS源和数据备份

## 配置说明

### 环境变量

创建 `.env` 文件来配置环境变量：

```bash
# 复制环境变量模板
cp .env.example .env
```

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| PORT | 后端服务端口 | 3001 | 否 |
| NODE_ENV | 运行环境 | production | 否 |
| TMDB_API_KEY | TMDB API密钥（用于获取影视信息） | - | 否 |
| TELEGRAM_BOT_TOKEN | Telegram机器人令牌 | - | 否 |
| DISCORD_BOT_TOKEN | Discord Bot Token | - | 否 |
| DISCORD_CHANNEL_ID | Discord 频道ID | - | 否 |

#### 获取API密钥

**TMDB API Key:**
1. 访问 [TMDB官网](https://www.themoviedb.org/)
2. 注册账号并申请API密钥
3. 在设置中配置API密钥

**Telegram Bot Token:**
1. 联系 @BotFather 创建机器人
2. 获取Bot Token
3. 获取Chat ID（发送消息后访问API获取）

**Discord Bot:**
1. 在Discord开发者门户创建Bot应用
2. 获取Bot Token和频道ID
3. 将Bot添加到服务器并授予权限

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

### 自动化部署

本项目使用GitHub Actions自动构建Docker镜像，每次推送到主分支或创建标签时会自动：

1. 构建多平台Docker镜像（linux/amd64, linux/arm64）
2. 推送到GitHub Container Registry (GHCR)
3. 支持语义化版本标签

**镜像地址：** `ghcr.io/yan-nian/rss-tv-monitor:latest`

### Docker部署

#### 使用预构建镜像

```bash
# 直接运行
docker run -d \
  -p 3000:80 \
  -p 3001:3001 \
  -v rss-data:/app/data \
  --name rss-monitor \
  ghcr.io/yan-nian/rss-tv-monitor:latest
```

#### 本地构建

```bash
# 构建镜像
docker build -t rss-monitor .

# 运行容器
docker run -d -p 3000:80 -p 3001:3001 --name rss-monitor rss-monitor
```

### 使用Docker Compose

#### 生产环境

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 开发环境

```bash
# 使用开发配置
docker-compose -f docker-compose.dev.yml up -d

# 支持代码热重载
```

### 更新部署

```bash
# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose up -d

# 清理旧镜像
docker image prune
```

### 构建测试

项目包含Docker构建测试脚本：

```bash
# 运行Docker构建测试
./test-docker-build.sh
```

该脚本会：
1. 构建Docker镜像
2. 测试容器启动
3. 验证服务可访问性
4. 自动清理测试资源

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
