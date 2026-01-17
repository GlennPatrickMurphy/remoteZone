# App Store Screenshot Guide

## Quick Start

1. **Start the app in simulator:**
   ```bash
   cd mobile-app
   npx expo run:ios
   ```

2. **Run the screenshot script:**
   ```bash
   ./take_screenshots.sh
   ```

3. **Follow the prompts** to take screenshots of each screen

## Manual Method

If you prefer to take screenshots manually:

### Step 1: Launch Simulator
```bash
# Boot iPhone 14 Pro Max or iPhone 15 Pro Max
xcrun simctl boot "iPhone 15 Pro Max"
open -a Simulator
```

### Step 2: Run Your App
```bash
cd mobile-app
npx expo run:ios
```

### Step 3: Navigate and Screenshot

**Screenshot 1: Home Screen**
- Navigate to Home screen
- Make sure monitoring is active (if possible)
- Show games list
- In Simulator: `Cmd+S` or Device → Screenshots → Save to Photos
- Or use: `xcrun simctl io booted screenshot screenshot-01-home.png`

**Screenshot 2: Configuration Screen**
- Navigate to Config screen
- Show channels configured
- Show game mapping
- Take screenshot: `xcrun simctl io booted screenshot screenshot-02-config.png`

**Screenshot 3: Authentication Screen**
- Navigate to Auth screen
- Show TV provider selection
- Take screenshot: `xcrun simctl io booted screenshot screenshot-03-auth.png`

**Screenshot 4: Profile Screen (Optional)**
- Navigate to Profile/Settings screen
- Take screenshot: `xcrun simctl io booted screenshot screenshot-04-profile.png`

## Required Sizes

- **Portrait**: 1242 x 2688px or 1284 x 2778px
- **Landscape**: 2688 x 1242px or 2778 x 1284px

## Verifying Screenshot Size

```bash
# Check dimensions
sips -g pixelWidth -g pixelHeight screenshot-01-home.png

# Resize if needed (to 1242x2688)
sips -z 2688 1242 screenshot-01-home.png --out screenshot-01-home-resized.png
```

## Tips

- Use real data when possible (actual game scores, channels)
- Remove any debug text or test data
- Ensure consistent state across screenshots
- Portrait orientation is required for App Store
- At least 3 screenshots are required

## Uploading to App Store Connect

1. Go to App Store Connect → Your App → App Store → Screenshots
2. Select "iPhone 6.5" Display"
3. Upload screenshots in order (most important first)
4. Apple will use the first 3 on the installation sheet






