# 🏈 NFL Redzone TV Controller - Quick Start

## ✅ Setup Complete!

Your NFL Redzone TV Controller is installed and **running right now**!

## 🚀 Access the Web Interface

**Open your browser and go to:**

```
http://localhost:8080
```

## 📋 What To Do Next

### 1. Configure Channels (30 seconds)
- Enter 2-3 channel numbers in the web interface
- Example: 502, 506, 510
- Click "Configure & Discover Games"

### 2. Authenticate Rogers (1 minute)
- Click "Open Rogers Remote"
- Sign in to your Rogers account
- Click "Check Authentication"

### 3. Start Monitoring (1 click)
- Click "Start Monitoring"
- Sit back and enjoy!

## 🎯 What Happens Next

The system will:
- ✅ Monitor all live NFL games every 30 seconds
- ✅ Detect when teams are in the redzone (< 30 yards)
- ✅ Automatically switch to the highest priority game in redzone
- ✅ Show you everything happening in real-time on the dashboard

## 📺 Channel Priority

- **Channel 1**: Highest Priority (switches here first)
- **Channel 2**: Medium Priority  
- **Channel 3**: Lowest Priority

If multiple teams are in the redzone, it switches to the highest priority game.

## 🎨 Web Dashboard Features

- **Live game cards** with redzone indicators
- **Real-time activity log** showing all actions
- **Current channel display**
- **Start/Stop controls**
- **Beautiful modern design**

## 🔍 Monitoring the System

Watch the web dashboard to see:
- Which games are being monitored
- When teams enter the redzone (pulsing red cards)
- When channels are changed
- All system activity in the log

## 📱 Access From Other Devices

The web interface is accessible from any device on your network:

```
http://[YOUR_COMPUTER_IP]:8080
```

Use your phone or tablet to monitor while watching TV!

## 🛑 Stopping the System

In the web interface:
- Click **"Stop Monitoring"** to pause
- Click **"Start Monitoring"** to resume

To shut down completely:
```bash
pkill -f web_controller.py
```

## 📚 More Information

- **Full Documentation**: See `README.md`
- **Web Interface Guide**: See `WEB_INTERFACE_GUIDE.md`
- **Activity Logs**: Check `nfl_redzone_controller.log`

## 🎉 You're All Set!

Open http://localhost:8080 and enjoy automatic NFL redzone coverage! 🏈

---

**Having issues?** Check the activity log in the web interface or the `nfl_redzone_controller.log` file for detailed information.
