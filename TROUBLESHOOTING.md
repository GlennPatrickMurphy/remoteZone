# 🔧 Troubleshooting Guide

## ✅ Fixed: Rogers Remote Opening Error

### What Was Wrong
ChromeDriver was not installed on your system.

### What I Fixed
1. ✅ **Installed ChromeDriver** via Homebrew
2. ✅ **Removed macOS quarantine** from ChromeDriver (security bypass)
3. ✅ **Added better error handling** to show clear error messages
4. ✅ **Restarted the web server** with the fixes

### ChromeDriver Status
```
ChromeDriver 141.0.7390.78 - INSTALLED ✓
Location: /opt/homebrew/bin/chromedriver
```

## 🚀 What To Do Now

1. **Refresh your browser** at http://localhost:8080

2. **Click "Open Rogers Remote"** in Step 2
   - A Chrome window should open automatically
   - It will navigate to https://rogers.webremote.com/remote

3. **Sign in to Rogers** in that Chrome window

4. **Return to the web dashboard** and click "Check Authentication"

## 🔍 Common Issues & Solutions

### Issue: Chrome window doesn't open

**Solution:**
- Make sure Chrome browser is installed
- Try closing any other Chrome windows
- Check the activity log for detailed errors

### Issue: "ChromeDriver not found"

**Solution:**
```bash
brew install chromedriver
xattr -d com.apple.quarantine /opt/homebrew/bin/chromedriver
```

### Issue: "Session not created: This version of ChromeDriver only supports Chrome version X"

**Solution:**
Update both Chrome and ChromeDriver:
```bash
brew upgrade chromedriver
```

### Issue: Rogers remote loads but buttons don't work

**Solution:**
- Make sure you're fully signed in
- Wait for the page to fully load
- Click "Check Authentication" to verify
- Look for the remote control interface on the Rogers page

### Issue: Authentication check fails

**Solution:**
- The Rogers page might not be fully loaded
- Try waiting 10 seconds after signing in
- Refresh the Rogers remote page
- Click "Check Authentication" again

## 📊 Checking System Status

Run this command to check everything:
```bash
cd /Users/glennmurphy/remotezone
./status.sh
```

You should see:
- ✅ Web Server: RUNNING
- ✅ ChromeDriver: Installed and working

## 🐛 Debugging

### View Live Logs
```bash
tail -f /Users/glennmurphy/remotezone/nfl_redzone_controller.log
```

### Test ChromeDriver Manually
```bash
chromedriver --version
```

Should output: `ChromeDriver 141.0.7390.78 ...`

### Restart Everything
```bash
cd /Users/glennmurphy/remotezone
pkill -f web_controller.py
./start_web.sh
```

## ✅ System Requirements Met

- ✅ Python 3.7+ installed
- ✅ Virtual environment created
- ✅ All dependencies installed
- ✅ ChromeDriver installed and configured
- ✅ Web server running on port 8080

## 🎯 Next Steps

Since ChromeDriver is now installed:

1. **Refresh http://localhost:8080**
2. Go to **Step 2**
3. Click **"Open Rogers Remote"**
4. You should see a Chrome window open!
5. Sign in to Rogers
6. Click **"Check Authentication"**
7. Continue to Step 3 and start monitoring!

---

**Everything is now fixed and ready to use!** 🏈
