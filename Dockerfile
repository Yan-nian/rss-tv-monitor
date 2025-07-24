# 多阶段构建：前端构建阶段
FROM node:18-alpine AS frontend-builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++ git

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建前端应用
RUN pnpm run build

# 生产阶段：包含前端和后端
FROM node:18-alpine

# 安装必要的系统依赖
RUN apk add --no-cache nginx supervisor

# 创建应用目录
WORKDIR /app

# 复制后端代码和依赖文件
COPY server/ ./server/
COPY package.json pnpm-lock.yaml ./

# 安装pnpm
RUN npm install -g pnpm

# 安装所有依赖（包括devDependencies用于构建前端）
RUN pnpm install --frozen-lockfile

# 复制前端构建产物到nginx目录
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 复制nginx配置文件
COPY nginx.conf /etc/nginx/nginx.conf

# 创建supervisor配置
RUN mkdir -p /etc/supervisor/conf.d
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 创建日志目录
RUN mkdir -p /var/log/supervisor

# 暴露端口
EXPOSE 80 3001

# 使用supervisor启动nginx和后端服务
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]