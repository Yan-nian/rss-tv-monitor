# Docker容器环境RSS源添加问题修复

## 问题描述

在Docker容器环境下，用户无法正常添加RSS源，前端请求失败。

## 问题原因

在 `src/services/rssService.ts` 文件中，API基础URL被硬编码为 `http://localhost:3001/api`，这在Docker容器环境中是不正确的。

### 问题分析

1. **开发环境**: 前端运行在 `localhost:5173`，后端运行在 `localhost:3001`，直接访问后端API正常
2. **Docker容器环境**: 
   - 前端通过nginx在端口80提供服务
   - 后端在容器内部端口3001运行
   - nginx配置了API代理：`/api/` -> `http://localhost:3001`
   - 前端应该通过相对路径 `/api` 访问API，而不是绝对路径 `http://localhost:3001/api`

## 解决方案

### 修改API基础URL

将 `src/services/rssService.ts` 中的API基础URL从绝对路径改为相对路径：

```typescript
// 修改前
class RSSService {
  private apiBaseUrl = 'http://localhost:3001/api';
  
// 修改后  
class RSSService {
  private apiBaseUrl = '/api';
```

### 工作原理

1. **开发环境**: Vite开发服务器配置了代理，将 `/api` 请求转发到 `http://localhost:3001`
2. **生产环境**: nginx配置了代理，将 `/api` 请求转发到容器内的后端服务

## 验证修复

1. 构建Docker镜像：
   ```bash
   docker build -t rss-monitor-test .
   ```

2. 运行容器：
   ```bash
   docker run -d --name rss-test -p 8080:80 -p 8081:3001 rss-monitor-test
   ```

3. 测试服务：
   ```bash
   # 测试前端
   curl http://localhost:8080
   
   # 测试API代理
   curl http://localhost:8080/api/health
   
   # 测试后端直接访问
   curl http://localhost:8081/api/health
   ```

## 相关文件

- `src/services/rssService.ts` - 修复API URL配置
- `nginx.conf` - nginx代理配置
- `vite.config.ts` - 开发环境代理配置
- `Dockerfile` - 容器构建配置

## 注意事项

1. 其他服务文件（如 `notificationService.ts`）已经正确使用相对路径
2. `tmdbService.ts` 使用外部API，无需修改
3. 此修复同时兼容开发环境和生产环境