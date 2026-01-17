#!/bin/bash

# Fix ChromeDriver Installation Script
# This script installs ChromeDriver using the Chrome for Testing API (for Chrome 115+)

echo "🔍 Checking Chrome version..."
CHROME_VERSION=$(google-chrome --version | awk '{print $3}')
CHROME_MAJOR_VERSION=$(echo $CHROME_VERSION | cut -d. -f1)

echo "Chrome version detected: $CHROME_VERSION (Major: $CHROME_MAJOR_VERSION)"

if [ "$CHROME_MAJOR_VERSION" -ge 115 ]; then
    echo "✅ Using Chrome for Testing API (Chrome 115+)"
    
    # Get the latest ChromeDriver version for this Chrome major version
    CHROMEDRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_MAJOR_VERSION}")
    
    if [ -z "$CHROMEDRIVER_VERSION" ]; then
        echo "❌ Error: Could not get ChromeDriver version"
        exit 1
    fi
    
    echo "📥 Downloading ChromeDriver version: $CHROMEDRIVER_VERSION"
    
    # Download ChromeDriver from Chrome for Testing
    wget -O /tmp/chromedriver.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip"
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to download ChromeDriver"
        exit 1
    fi
    
    echo "📦 Extracting ChromeDriver..."
    # Extract the chromedriver binary from the nested directory
    sudo unzip -j /tmp/chromedriver.zip "chromedriver-linux64/chromedriver" -d /usr/local/bin/
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to extract ChromeDriver"
        exit 1
    fi
    
    echo "🔧 Setting permissions..."
    sudo chmod +x /usr/local/bin/chromedriver
    
else
    echo "✅ Using legacy method (Chrome < 115)"
    
    # Use old method for Chrome < 115
    CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_MAJOR_VERSION}")
    
    if [ -z "$CHROMEDRIVER_VERSION" ]; then
        echo "❌ Error: Could not get ChromeDriver version"
        exit 1
    fi
    
    echo "📥 Downloading ChromeDriver version: $CHROMEDRIVER_VERSION"
    
    wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip"
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to download ChromeDriver"
        exit 1
    fi
    
    echo "📦 Extracting ChromeDriver..."
    sudo unzip /tmp/chromedriver.zip -d /usr/local/bin/
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to extract ChromeDriver"
        exit 1
    fi
    
    echo "🔧 Setting permissions..."
    sudo chmod +x /usr/local/bin/chromedriver
fi

echo "🧹 Cleaning up..."
rm -f /tmp/chromedriver.zip

echo "✅ Verifying installation..."
chromedriver --version

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ChromeDriver installed successfully!"
    echo "   Location: /usr/local/bin/chromedriver"
    chromedriver --version
else
    echo "❌ Error: ChromeDriver verification failed"
    exit 1
fi

