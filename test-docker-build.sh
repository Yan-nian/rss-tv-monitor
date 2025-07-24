#!/bin/bash

# Docker构建测试脚本
echo "开始测试Docker构建..."

# 清理旧的镜像
echo "清理旧镜像..."
docker rmi rss-monitor-test 2>/dev/null || true

# 构建新镜像
echo "构建Docker镜像..."
if docker build -t rss-monitor-test .; then
    echo "✅ Docker镜像构建成功！"
    
    # 显示镜像信息
    echo "镜像信息："
    docker images rss-monitor-test
    
    # 测试运行容器
    echo "测试运行容器..."
    CONTAINER_ID=$(docker run -d -p 8080:80 -p 8081:3001 --name rss-test rss-monitor-test)
    
    if [ $? -eq 0 ]; then
        echo "✅ 容器启动成功！"
        echo "容器ID: $CONTAINER_ID"
        echo "前端访问地址: http://localhost:8080"
        echo "后端API地址: http://localhost:8081"
        
        # 等待几秒让服务启动
        echo "等待服务启动..."
        sleep 5
        
        # 测试前端是否可访问
        if curl -s http://localhost:8080 > /dev/null; then
            echo "✅ 前端服务正常！"
        else
            echo "❌ 前端服务无法访问"
        fi
        
        # 清理测试容器
        echo "清理测试容器..."
        docker stop rss-test
        docker rm rss-test
    else
        echo "❌ 容器启动失败！"
        exit 1
    fi
else
    echo "❌ Docker镜像构建失败！"
    exit 1
fi

echo "Docker构建测试完成！"