
# 构建阶段
FROM node:20-alpine as builder

# 设置工作目录
WORKDIR /app

# 首先只复制依赖相关文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci --quiet

# 然后复制其余源代码
COPY . .

# 构建项目
RUN npm run build

# 生产环境阶段
FROM nginx:alpine

# 复制构建产物到 Nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 添加自定义 nginx 配置以支持 SPA 路由
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]