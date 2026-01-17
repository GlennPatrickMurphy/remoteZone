#!/bin/bash

# Verification Script for Server Clone
# Run this on your server to verify the clone worked

echo "🔍 Verifying Git Clone..."
echo ""

# Check current directory
echo "📍 Current directory:"
pwd
echo ""

# Check if this is a git repository
if [ -d ".git" ]; then
    echo "✅ This is a git repository"
    git remote -v
else
    echo "❌ This is NOT a git repository"
    echo "   Run: git clone https://github.com/GlennPatrickMurphy/remoteZone.git ."
fi
echo ""

# List all files
echo "📁 Files in current directory:"
ls -la | head -20
echo ""

# Check for key files
echo "🔑 Checking for key files:"
for file in requirements.txt web_controller.py wsgi.py start_production.sh; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file MISSING"
    fi
done
echo ""

# Check git status
if [ -d ".git" ]; then
    echo "📊 Git status:"
    git status --short
    echo ""
    
    echo "📦 Files tracked by git:"
    git ls-files | head -15
fi


