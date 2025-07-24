# Docker 部署指南

本项目支持多种Docker部署方式，包括使用预构建镜像和本地构建。

## 快速开始

### 使用预构建镜像（推荐）

1. 下载 docker-compose.yml 文件：
```bash
wget https://raw.githubusercontent.com/Yan-nian/rss-tv-monitor/main/docker-compose.yml
```

2. 启动服务：
```bash
docker-compose up -d
```

3. 访问应用：
   - 前端界面：http://localhost:3000
   - 后端API：http://localhost:3001

### 本地构建

1. 克隆项目：
```bash
git clone https://github.com/Yan-nian/rss-tv-monitor.git
cd rss-tv-monitor
```

2. 修改 docker-compose.yml：
```yaml
# 注释掉 image 行，取消注释 build 行
# image: ghcr.io/yan-nian/rss-tv-monitor:latest
build: .
```

3. 构建并启动：
```bash
docker-compose up -d --build
```

## 配置说明

### 环境变量

创建 `.env` 文件来配置环境变量：

```bash
# TMDB配置（可选）
TMDB_API_KEY=your_tmdb_api_key

# Telegram通知配置（可选）
TELEGRAM_BOT_TOKEN=your_bot_token

# Discord通知配置（可选）
DISCORD_WEBHOOK_URL=your_webhook_url
```

### 数据持久化

应用数据存储在Docker卷中：
- `rss-data`：存储应用配置和数据

查看数据卷：
```bash
docker volume ls | grep rss
```

备份数据：
```bash
docker run --rm -v rss-data:/data -v $(pwd):/backup alpine tar czf /backup/rss-backup.tar.gz -C /data .
```

恢复数据：
```bash
docker run --rm -v rss-data:/data -v $(pwd):/backup alpine tar xzf /backup/rss-backup.tar.gz -C /data
```

## 开发环境

使用开发环境配置：

```bash
docker-compose -f docker-compose.dev.yml up -d
```

开发环境特点：
- 挂载源代码目录，支持热重载
- 独立的网络和数据卷
- 开发模式配置

## 健康检查

容器包含健康检查功能，检查服务状态：

```bash
# 查看健康状态
docker-compose ps

# 查看健康检查日志
docker inspect rss-monitor | grep Health -A 10
```

## 日志管理

查看应用日志：

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs rss-monitor

# 实时跟踪日志
docker-compose logs -f

# 查看supervisor日志
docker exec rss-monitor tail -f /var/log/supervisor/supervisord.log
```

## 更新应用

### 更新预构建镜像

```bash
# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose up -d
```

### 更新本地构建

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 修改 docker-compose.yml 中的端口映射
   ports:
     - "8080:80"    # 改为其他端口
     - "8081:3001"
   ```

2. **权限问题**
   ```bash
   # 确保Docker有足够权限
   sudo docker-compose up -d
   ```

3. **网络问题**
   ```bash
   # 重建网络
   docker-compose down
   docker network prune
   docker-compose up -d
   ```

4. **数据丢失**
   ```bash
   # 检查数据卷
   docker volume inspect rss-data
   ```

### 调试模式

进入容器调试：

```bash
# 进入运行中的容器
docker exec -it rss-monitor sh

# 查看进程状态
docker exec rss-monitor supervisorctl status

# 重启特定服务
docker exec rss-monitor supervisorctl restart backend
```

## 性能优化

### 资源限制

在 docker-compose.yml 中添加资源限制：

```yaml
services:
  rss-monitor:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 镜像优化

- 使用多阶段构建减少镜像大小
- 使用 Alpine Linux 基础镜像
- 清理不必要的依赖和缓存

## 安全建议

1. **网络安全**
   - 使用反向代理（如Nginx）
   - 配置HTTPS证书
   - 限制外部访问端口

2. **数据安全**
   - 定期备份数据
   - 使用环境变量存储敏感信息
   - 不要在镜像中包含敏感数据

3. **更新维护**
   - 定期更新基础镜像
   - 监控安全漏洞
   - 及时应用补丁更新