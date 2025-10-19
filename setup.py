#!/usr/bin/env python3
"""
Setup script for NFL Redzone TV Controller
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required Python packages"""
    print("Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return False

def check_chromedriver():
    """Check if ChromeDriver is available"""
    print("Checking ChromeDriver...")
    try:
        result = subprocess.run(["chromedriver", "--version"], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✅ ChromeDriver found")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    print("❌ ChromeDriver not found in PATH")
    print("Please install ChromeDriver:")
    print("1. Download from https://chromedriver.chromium.org/")
    print("2. Make sure it matches your Chrome browser version")
    print("3. Add to PATH or place in this directory")
    return False

def main():
    """Main setup function"""
    print("🏈 NFL Redzone TV Controller Setup")
    print("=" * 40)
    
    # Check Python version
    if sys.version_info < (3, 7):
        print("❌ Python 3.7+ required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version.split()[0]} detected")
    
    # Install dependencies
    if not install_requirements():
        sys.exit(1)
    
    # Check ChromeDriver
    chromedriver_ok = check_chromedriver()
    
    print("\n" + "=" * 40)
    if chromedriver_ok:
        print("🎉 Setup complete! You can now run:")
        print("   python nfl_redzone_controller.py")
    else:
        print("⚠️  Setup mostly complete, but ChromeDriver needs to be installed")
        print("   Once ChromeDriver is installed, run:")
        print("   python nfl_redzone_controller.py")

if __name__ == "__main__":
    main()

