# Setup on Ubuntu VPS

## 1. Upload to VPS

```bash
# From local machine:
scp -r server/ ubuntu@YOUR_VPS_IP:/home/ubuntu/hypertrophy-coach/
ssh ubuntu@YOUR_VPS_IP
```

## 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 3. Install & Configure

```bash
cd /home/ubuntu/hypertrophy-coach/server
npm install
cp .env.example .env
nano .env  # Add your KIMI_API_KEY
```

## 4. Run with PM2

```bash
sudo npm install -g pm2
pm2 start server.js --name "hypertrophy-coach"
pm2 save
pm2 startup
```

## 5. Test

```bash
curl http://localhost:3000/health
```

## 6. Nginx Reverse Proxy (Optional)

```bash
sudo apt install nginx
# Config in /etc/nginx/sites-available/coach
# Proxy to localhost:3000
```

## Update App Endpoint

In `js/ai-coach-api.js`, change:
```javascript
const API_BASE = 'http://YOUR_VPS_IP:3000';
```
