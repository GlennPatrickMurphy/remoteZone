# 📱 Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd mobile-app
npm install
```

## Step 2: Configure API Connection

1. **Find your Mac's IP address**:
   - System Settings > Network > Wi-Fi > Details
   - Copy the IP address (e.g., `192.168.1.100`)

2. **Update the API config**:
   - Open `src/config/api.js`
   - Replace `XXX` with your Mac's IP:
     ```javascript
     export const API_BASE_URL = __DEV__ 
       ? 'http://localhost:8080'  // iOS Simulator
       : 'http://192.168.1.100:8080'; // Your Mac's IP
     ```

## Step 3: Start Flask Backend

Make sure the Flask server is running on your Mac:

```bash
cd /Users/glennmurphy/remotezone
./start_web.sh
```

## Step 4: Run the App

### Option A: Using Expo Go (Recommended for testing)

1. **Install Expo Go** on your iPhone from the App Store

2. **Start the Expo server**:
   ```bash
   cd mobile-app
   npm start
   ```

3. **Open on iPhone**:
   - Scan the QR code with your iPhone camera
   - Or open Expo Go and enter the connection URL shown

### Option B: iOS Simulator (Development)

```bash
cd mobile-app
npm run ios
```

This will open the app in the iOS Simulator on your Mac.

## Step 5: First Use

1. **Navigate to Configuration**: Tap "Configuration" on home screen
2. **Set up channels**: Enter at least 2 channel numbers
3. **Map games**: Load games and map them to channels
4. **Authenticate**: Go to "Authentication" screen
   - Tap "Open Rogers Remote" (opens browser on Mac)
   - Sign in to Rogers
   - Tap "Check Authentication"
   - Test channel change
5. **Start Monitoring**: Return to home screen and tap "Start Monitoring"

## Troubleshooting

### Can't Connect

- ✅ Check Mac IP address is correct in `src/config/api.js`
- ✅ Ensure Flask server is running (`./start_web.sh`)
- ✅ iPhone and Mac on same Wi-Fi network
- ✅ Mac firewall allows port 8080

### Expo Connection Issues

- ✅ Both devices on same Wi-Fi network
- ✅ Try manual URL in Expo Go
- ✅ Restart Expo server: `npm start --clear`

### Authentication Issues

- ✅ Open remote first (opens browser on Mac)
- ✅ Complete sign-in in browser
- ✅ Tap "Check Authentication" in app
- ✅ Test channel change before monitoring

## Notes

- The app connects to Flask backend - backend must be running
- Selenium automation runs on Mac (not on iPhone)
- Keep Mac awake while monitoring
- Use same Wi-Fi network for both devices

