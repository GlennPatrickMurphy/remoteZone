# 🚀 Server Deployment Guide

## Overview

This is now a **web app** that can be deployed on a server. The server controls the TV directly using Selenium, so it works completely independently - no phone app needed.

## Key Changes

✅ **Server-side TV control** - Server automatically changes channels using Selenium  
✅ **Multi-provider support** - Supports Rogers, Xfinity, and Shaw  
✅ **Production-ready** - Includes Gunicorn configuration for deployment  
✅ **No mobile app required** - Works entirely through web browser  

## Server Requirements

- **Python 3.7+**
- **Chrome browser** (latest version)
- **ChromeDriver** (matching Chrome version)
- **Linux/Ubuntu server** recommended for production

## Installation on Server

### 1. Install System Dependencies

```bash
# Update package list
sudo apt update

# Install Python and pip
sudo apt install python3 python3-pip python3-venv

# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-stable

# Install ChromeDriver (must match Chrome version)
CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d. -f1)
CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}")
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip"
sudo unzip /tmp/chromedriver.zip -d /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
```

### 2. Setup Application

```bash
# Clone or upload your code to server
cd /opt/remotezone  # or your preferred location

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Firewall

```bash
# Allow port 8080
sudo ufw allow 8080/tcp
sudo ufw enable
```

## Running the Server

### Development Mode (for testing)

```bash
./start_web.sh
```

### Production Mode (recommended)

```bash
./start_production.sh
```

This runs with Gunicorn (4 workers, 2 threads each) for better performance.

## Deployment Options

### Option 1: Systemd Service (Recommended)

Create `/etc/systemd/system/nfl-redzone.service`:

```ini
[Unit]
Description=NFL Redzone Controller
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/opt/remotezone
Environment="PATH=/opt/remotezone/venv/bin"
ExecStart=/opt/remotezone/venv/bin/gunicorn -w 4 -b 0.0.0.0:8080 --threads 2 --timeout 120 wsgi:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
sudo systemctl enable nfl-redzone
sudo systemctl start nfl-redzone
sudo systemctl status nfl-redzone
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install Chrome and ChromeDriver
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d. -f1) \
    && CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}") \
    && wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip" \
    && unzip /tmp/chromedriver.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm /tmp/chromedriver.zip

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8080", "--threads", "2", "--timeout", "120", "wsgi:app"]
```

Build and run:

```bash
docker build -t nfl-redzone .
docker run -d -p 8080:8080 --name nfl-redzone nfl-redzone
```

### Option 3: With Nginx Reverse Proxy (for HTTPS)

1. Install Nginx:
```bash
sudo apt install nginx
```

2. Configure Nginx (`/etc/nginx/sites-available/nfl-redzone`):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/nfl-redzone /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. Add SSL with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Accessing the Web App

Once deployed, access the web interface:

```
http://your-server-ip:8080
```

Or with domain:
```
https://your-domain.com
```

## Using the Web App

### 1. Configure Channels
- Enter 2-3 channel numbers
- Click "Save Channels"

### 2. Select TV Provider
- Choose Rogers, Xfinity, or Shaw from dropdown
- Click "Open Remote" - a Chrome window will open (on server)
- Sign in to your provider in that window
- Click "Check Authentication"

### 3. Select Games
- Click "Load Today's Games"
- Select which games to monitor and assign channels
- Set priorities

### 4. Start Monitoring
- Click "Start Monitoring"
- Server will automatically change channels based on redzone activity!

## Important Notes

- **Headless Mode**: After authentication, the server runs Chrome in headless mode (invisible)
- **Authentication**: The Chrome window for authentication will open on the server. You may need to use VNC or X11 forwarding to see it, or authenticate before deploying
- **Multiple Users**: Multiple users can access the web interface, but only one can authenticate at a time
- **ChromeDriver**: Must match Chrome version. Update both when Chrome updates

## Troubleshooting

### ChromeDriver Version Mismatch
```bash
# Check Chrome version
google-chrome --version

# Download matching ChromeDriver
CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d. -f1)
# Then download matching ChromeDriver
```

### Headless Chrome Issues
If authentication fails in headless mode, temporarily disable it:
```python
# In web_controller.py, RogersRemoteController.__init__
self.headless = False  # For debugging
```

### Permission Issues
```bash
# Make scripts executable
chmod +x start_web.sh start_production.sh

# Check ChromeDriver permissions
ls -l /usr/local/bin/chromedriver
```

## Production Best Practices

1. **Use systemd service** for automatic restarts
2. **Set up log rotation** for `nfl_redzone_controller.log`
3. **Monitor resource usage** (Chrome can be memory-intensive)
4. **Use Nginx reverse proxy** for HTTPS
5. **Set up firewall** properly (only expose 8080 or 443)
6. **Regular backups** of configuration files

## Security Considerations

- The server controls your TV, so secure it properly
- Use HTTPS in production
- Consider adding authentication to the web interface
- Don't expose port 8080 publicly without proper security

