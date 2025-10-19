# NFL Redzone TV Controller - Web Interface Guide

## 🎯 Quick Start

1. Run: `./start_web.sh`
2. Open: http://localhost:8080
3. Follow the 3 steps on the dashboard

## 📱 Web Interface Features

### Dashboard Overview

The web interface provides a beautiful, modern dashboard with:

- **Real-time Status Display**
  - Current monitoring status (Active/Inactive)
  - Currently tuned channel
  - Authentication status

- **3-Step Setup Process**
  - Step 1: Configure Channels
  - Step 2: Authenticate with Rogers
  - Step 3: Start Monitoring

- **Live Game Cards**
  - Shows all discovered NFL games
  - Displays team matchups
  - Shows channel and priority
  - **Redzone indicator** (pulsing red border when team is in redzone)
  - Live yards-to-endzone updates

- **Activity Log**
  - Real-time log of all actions
  - Color-coded messages (info/warning/error)
  - Auto-scrolls to latest activity
  - Shows redzone detections and channel changes

## 🎨 Visual Features

### Redzone Animation
When a team enters the redzone:
- Game card gets a **pulsing red border**
- Shows "🔴 REDZONE: [Team Name]"
- Updates every 30 seconds

### Status Indicators
- **Green badge**: Active/Authenticated
- **Red badge**: Inactive/Not Authenticated
- **Orange badge**: Pending

### Real-time Updates
- Dashboard updates every 2 seconds
- No need to refresh the page
- See live changes as they happen

## 🎮 Using the Interface

### Step 1: Configure Channels

1. Enter at least 2 channel numbers
   - **Channel 1**: Highest priority (e.g., 502)
   - **Channel 2**: Medium priority (e.g., 506)
   - **Channel 3**: Lowest priority (optional, e.g., 510)

2. Click **"Configure & Discover Games"**

3. Wait for confirmation and game discovery

### Step 2: Authenticate

1. Click **"Open Rogers Remote"**
   - A new browser window/tab will open
   - You'll see the Rogers web remote page

2. Sign in to your Rogers account

3. Return to the dashboard

4. Click **"Check Authentication"**
   - Status should change to "Authenticated ✓"

### Step 3: Monitor & Control

1. Click **"Start Monitoring"**
   - Status changes to "Monitoring" (green)
   - Activity log shows monitoring started

2. Watch the magic happen:
   - Games update every 30 seconds
   - Redzone detection happens automatically
   - Channels switch based on priority

3. **Control buttons**:
   - **Stop Monitoring**: Pause automatic switching
   - **Refresh Games**: Update game list

## 📊 Game Card Details

Each game card shows:
- **Matchup**: Away Team @ Home Team
- **Channel**: The TV channel number
- **Priority**: 1 (highest) to 3 (lowest)
- **Yards to Endzone**: Current field position
- **Redzone Status**: Shows when team is in redzone

### Redzone Card Example
```
[PULSING RED BORDER]
════════════════════════
Kansas City Chiefs @ Buffalo Bills

Channel: 502      Priority: 1
Yards to Endzone: 18

🔴 REDZONE: Kansas City Chiefs
════════════════════════
```

## 📝 Activity Log

The activity log shows:
- Configuration actions
- Game discoveries
- Redzone detections (with team and yards)
- Channel changes
- Errors and warnings

Example log entries:
```
17:45:23  Configured 3 channels
17:45:25  Discovered 3 live games
17:46:02  🔴 Redzone: Chiefs at 22 yards - Chiefs @ Bills (Ch 502)
17:46:03  📺 Changed to channel 502
```

## 🔧 Advanced Features

### Multiple Simultaneous Redzones
If multiple games have redzone activity:
- Priority determines which channel to show
- Lower priority number = shown first
- Activity log shows all redzone games

### Auto-Refresh
- Status updates every 2 seconds
- Game data refreshes every 30 seconds
- No manual refresh needed

### Error Handling
- Connection errors shown in activity log
- Authentication failures clearly indicated
- Recovers automatically from temporary issues

## 💡 Tips

1. **Keep the browser tab open** for real-time updates
2. **Check the activity log** if channel switching isn't working
3. **Refresh games** if new games start during your session
4. **Use fullscreen** on a second monitor for best experience
5. **Mobile friendly** - works on tablets and phones too!

## 🚨 Troubleshooting

### "Not Authenticated" after signing in
- Click "Check Authentication" again
- Make sure Rogers remote page has fully loaded
- Try refreshing the Rogers remote page

### Games not updating
- Click "Refresh Games"
- Check activity log for errors
- Verify internet connection

### Channel not changing
- Verify Rogers remote is still logged in
- Check authentication status
- Look for errors in activity log

## 🎉 Enjoy!

Your TV will now automatically switch to the most exciting game based on redzone activity. Sit back and enjoy the action! 🏈
