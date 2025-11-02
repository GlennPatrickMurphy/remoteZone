# 🏈 NFL Redzone Controller - iPhone App

This is the iPhone app version of the NFL Redzone Controller. It connects to the Flask backend running on your Mac to monitor NFL games and automatically switch TV channels.

## 📱 Features

- **Real-time Status**: View current channel, game status, and monitoring state
- **Configuration**: Set up channels and map games to channels
- **Authentication**: Open Rogers remote on your Mac and authenticate
- **Control**: Start/stop monitoring with a single tap
- **Game Monitoring**: View all tracked games with redzone indicators
- **Activity Log**: See recent activity and channel changes

## 🚀 Setup Instructions

### Prerequisites

1. **Flask Backend Running**: Make sure the Flask server is running on your Mac
   ```bash
   cd /Users/glennmurphy/remotezone
   ./start_web.sh
   ```

2. **Same Wi-Fi Network**: Your iPhone and Mac must be on the same Wi-Fi network

3. **Expo Go App**: Install Expo Go on your iPhone from the App Store

### Configuration

1. **Find Your Mac's IP Address**:
   - On your Mac: System Settings > Network > Wi-Fi > Details
   - Copy the IP address (e.g., `192.168.1.100`)

2. **Update API Configuration**:
   - Open `mobile-app/src/config/api.js`
   - Replace `XXX` in `http://192.168.1.XXX:8080` with your Mac's IP address
   - Example: `http://192.168.1.100:8080`

3. **Firewall Settings** (if needed):
   - System Settings > Network > Firewall
   - Allow connections on port 8080

### Running the App

#### Option 1: Using Expo Go (Development)

1. **Install dependencies**:
   ```bash
   cd mobile-app
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open on iPhone**:
   - Scan the QR code with your iPhone camera
   - Or open Expo Go app and enter the connection URL

#### Option 2: Build Standalone App

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**:
   ```bash
   eas login
   eas build:configure
   ```

3. **Build for iOS**:
   ```bash
   eas build --platform ios
   ```

## 📱 Using the App

### 1. Home Screen
- View current status and channel
- Start/stop monitoring
- Navigate to other screens

### 2. Configuration Screen
- Set up channels (minimum 2 required)
- Map games to channels
- Load today's games
- Clear game mappings

### 3. Authentication Screen
- Open Rogers remote on your Mac
- Check authentication status
- Test channel changes

## 🔧 Troubleshooting

### Can't Connect to Server

1. **Check IP Address**: Make sure you updated the IP in `src/config/api.js`
2. **Check Flask Server**: Ensure `./start_web.sh` is running
3. **Same Network**: Both devices must be on the same Wi-Fi
4. **Firewall**: Allow port 8080 on your Mac's firewall

### Expo Go Connection Issues

1. **Same Network**: iPhone and Mac must be on same Wi-Fi
2. **Firewall**: Allow Expo dev server ports
3. **Manual URL**: Try entering the connection URL manually in Expo Go

### Authentication Issues

1. **Open Remote First**: Tap "Open Rogers Remote" first
2. **Sign In**: Sign in to Rogers in the browser window on your Mac
3. **Check Auth**: Return to app and tap "Check Authentication"

## 📝 Notes

- The app connects to the Flask backend, so the backend must be running
- The Selenium automation still runs on your Mac (not on iPhone)
- Channel changes are sent from iPhone to Mac, which controls the TV
- Make sure your Mac stays awake while monitoring

## 🎯 Development

### Project Structure

```
mobile-app/
├── src/
│   ├── screens/          # App screens
│   │   ├── HomeScreen.js
│   │   ├── ConfigScreen.js
│   │   └── AuthScreen.js
│   ├── services/         # API service
│   │   └── api.js
│   └── config/           # Configuration
│       └── api.js
├── App.js                # Main app component
└── package.json
```

### Adding Features

1. **New API Endpoint**: Add to `src/services/api.js`
2. **New Screen**: Create in `src/screens/` and add to navigation in `App.js`
3. **Styling**: Update StyleSheet in respective screen files

## 📄 License

Same as main project.

