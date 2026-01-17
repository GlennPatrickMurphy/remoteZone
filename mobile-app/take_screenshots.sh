#!/bin/bash

# Script to take App Store screenshots for iOS
# This script prepares the simulator and takes screenshots

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEVICE_NAME="iPhone 15 Pro Max"  # 6.5" display equivalent
OUTPUT_DIR="./app-store-screenshots"
SCREENSHOT_PREFIX="screenshot"

echo -e "${GREEN}📸 App Store Screenshot Generator${NC}"
echo "=================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo -e "${GREEN}✓${NC} Created output directory: $OUTPUT_DIR"

# Check if xcrun is available
if ! command -v xcrun &> /dev/null; then
    echo -e "${RED}✗${NC} xcrun not found. Please install Xcode Command Line Tools."
    exit 1
fi

# Check if simulator is available
if ! command -v xcrun simctl &> /dev/null; then
    echo -e "${RED}✗${NC} Simulator tools not found. Please install Xcode."
    exit 1
fi

echo -e "${GREEN}✓${NC} Xcode tools found"

# List available devices
echo ""
echo "Available devices:"
xcrun simctl list devices available | grep "iPhone" | head -5

# Get device UDID
DEVICE_UDID=$(xcrun simctl list devices available | grep "$DEVICE_NAME" | head -1 | grep -o '([-A-F0-9]*)' | sed 's/[()]//g')

if [ -z "$DEVICE_UDID" ]; then
    echo -e "${YELLOW}⚠${NC} Device '$DEVICE_NAME' not found. Trying alternative..."
    DEVICE_UDID=$(xcrun simctl list devices available | grep "iPhone 14 Pro Max" | head -1 | grep -o '([-A-F0-9]*)' | sed 's/[()]//g')
fi

if [ -z "$DEVICE_UDID" ]; then
    echo -e "${RED}✗${NC} Could not find suitable device. Please create an iPhone 14 Pro Max or iPhone 15 Pro Max simulator."
    echo ""
    echo "To create a device:"
    echo "  Open Xcode → Window → Devices and Simulators"
    echo "  Click '+' to add a new simulator"
    echo "  Choose iPhone 14 Pro Max or iPhone 15 Pro Max"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found device: $DEVICE_NAME (UDID: $DEVICE_UDID)"

# Boot simulator
echo ""
echo -e "${YELLOW}🔄${NC} Booting simulator..."
xcrun simctl boot "$DEVICE_UDID" 2>/dev/null || echo "Simulator already booted"

# Wait for simulator to be ready
sleep 3

# Open Simulator app
open -a Simulator

# Wait a bit more for simulator to fully load
sleep 2

echo ""
echo -e "${GREEN}✓${NC} Simulator is ready!"
echo ""
echo "=================================="
echo -e "${YELLOW}📱 MANUAL STEPS REQUIRED${NC}"
echo "=================================="
echo ""
echo "1. Make sure your app is running in the simulator"
echo "2. Navigate to each screen you want to capture"
echo "3. Press ENTER here to take a screenshot"
echo ""
echo "Screenshots will be saved to: $OUTPUT_DIR"
echo ""
echo "Recommended screenshots (in order):"
echo "  1. Home Screen (monitoring active with games)"
echo "  2. Configuration Screen (channels configured)"
echo "  3. Authentication Screen (TV provider selection)"
echo "  4. Profile Screen (optional)"
echo ""

# Function to take screenshot
take_screenshot() {
    local screen_name=$1
    local filename="${SCREENSHOT_PREFIX}-${screen_name}-$(date +%Y%m%d-%H%M%S).png"
    local filepath="${OUTPUT_DIR}/${filename}"
    
    echo -e "${YELLOW}📸${NC} Taking screenshot: $screen_name"
    xcrun simctl io "$DEVICE_UDID" screenshot "$filepath"
    
    if [ -f "$filepath" ]; then
        echo -e "${GREEN}✓${NC} Saved: $filename"
        
        # Get image dimensions
        if command -v sips &> /dev/null; then
            dimensions=$(sips -g pixelWidth -g pixelHeight "$filepath" 2>/dev/null | grep -E "pixelWidth|pixelHeight" | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//')
            echo "   Dimensions: $dimensions"
        fi
    else
        echo -e "${RED}✗${NC} Failed to save screenshot"
    fi
    echo ""
}

# Interactive screenshot taking
echo "Press ENTER to take a screenshot for each screen."
echo "Type 'done' when finished."
echo ""

counter=1
while true; do
    read -p "Screen name (1=Home, 2=Config, 3=Auth, 4=Profile, or 'done'): " screen_choice
    
    if [ "$screen_choice" = "done" ]; then
        break
    fi
    
    case $screen_choice in
        1|home|Home)
            take_screenshot "01-home"
            ;;
        2|config|Config)
            take_screenshot "02-config"
            ;;
        3|auth|Auth)
            take_screenshot "03-auth"
            ;;
        4|profile|Profile)
            take_screenshot "04-profile"
            ;;
        *)
            echo "Invalid choice. Use 1, 2, 3, 4, or 'done'"
            ;;
    esac
    
    counter=$((counter + 1))
done

echo ""
echo -e "${GREEN}✅${NC} Screenshots complete!"
echo ""
echo "Screenshots saved to: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Review the screenshots"
echo "2. Ensure they're at 1242x2688px or 1284x2778px"
echo "3. Upload to App Store Connect"






