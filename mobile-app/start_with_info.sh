#!/bin/bash

# Get Mac's IP address
MAC_IP=$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo "=========================================="
echo "🏈 NFL Redzone Controller - Mobile App"
echo "=========================================="
echo ""
echo "📱 Connection Information:"
echo "   Mac IP: $MAC_IP"
echo "   Port: 8085"
echo ""
echo "🔗 Expo Go Connection URL:"
echo "   exp://$MAC_IP:8085"
echo ""
echo "📋 To connect on iPhone:"
echo "   1. Open Expo Go app"
echo "   2. Tap 'Enter URL manually'"
echo "   3. Enter: exp://$MAC_IP:8085"
echo ""
echo "=========================================="
echo ""
echo "Starting Expo server..."
echo ""

cd /Users/glennmurphy/remotezone/mobile-app
npm start

