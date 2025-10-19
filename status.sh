#!/bin/bash

echo "🏈 NFL Redzone TV Controller - Status Check"
echo "=========================================="
echo ""

# Check if web server is running
if lsof -ti:8080 > /dev/null 2>&1; then
    echo "✅ Web Server: RUNNING"
    echo "   Access at: http://localhost:8080"
    echo ""
    
    # Get API status
    echo "📊 Current Status:"
    curl -s http://localhost:8080/api/status | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"   Monitoring: {'ACTIVE' if data['is_running'] else 'INACTIVE'}\")
print(f\"   Authenticated: {'YES' if data['is_authenticated'] else 'NO'}\")
print(f\"   Current Channel: {data['current_channel'] if data['current_channel'] else 'None'}\")
print(f\"   Games Tracked: {len(data['games'])}\")
"
else
    echo "❌ Web Server: NOT RUNNING"
    echo "   Run: ./start_web.sh"
fi

echo ""
echo "=========================================="
