#!/bin/bash

# Tên ứng dụng (thay đổi nếu muốn)
APP_NAME="godly-open-world"
REGION="sin" # Region gần bạn, ví dụ: Singapore (sin)

# Kiểm tra và cài flyctl nếu chưa có
if ! command -v flyctl &> /dev/null; then
    echo "flyctl not found. Installing..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Tạo thư mục dự án
echo "Creating project directory: $APP_NAME"
mkdir -p $APP_NAME
cd $APP_NAME

# Tạo package.json
echo "Creating package.json"
cat <<EOL > package.json
{
  "name": "$APP_NAME",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
EOL

# Cài dependencies
echo "Installing dependencies"
npm install

# Tạo Dockerfile
echo "Creating Dockerfile"
cat <<EOL > Dockerfile
FROM node:22

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
EOL

# Tạo fly.toml
echo "Creating fly.toml"
cat <<EOL > fly.toml
app = "$APP_NAME"
primary_region = "$REGION"

[build]
  builder = "docker"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[mounts]
  source = "data"
  destination = "/data"
EOL

# Copy các file hiện có (giả sử bạn đã có server.js, index.html, styles.css, game.js)
echo "Copying existing files (assuming they are in parent directory)"
cp ../server.js ../index.html ../styles.css ../game.js . 2>/dev/null || echo "Warning: Some files not found in parent directory"

# Khởi tạo Fly.io app
echo "Initializing Fly.io app"
flyctl auth login || flyctl auth signup
flyctl apps create --name $APP_NAME

# Tạo volume
echo "Creating volume (1GB)"
flyctl volumes create data --region $REGION --size 1

# Deploy ứng dụng
echo "Deploying to Fly.io"
flyctl deploy

echo "Setup complete! Your app is running at: https://$APP_NAME.fly.dev"
echo "Next steps:"
echo "1. Host front-end (index.html, styles.css, game.js) on GitHub Pages or Vercel."
echo "2. Update game.js WebSocket URL to: wss://$APP_NAME.fly.dev"