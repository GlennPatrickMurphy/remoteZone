# NFL Redzone TV Controller

An automated script that monitors NFL games for redzone activity and automatically changes your TV channel based on priority when teams are in the redzone.

## Features

- **Real-time NFL monitoring**: Fetches live game data from ESPN API every 30 seconds
- **Redzone detection**: Automatically detects when teams are within 30 yards of the endzone
- **Priority-based channel switching**: Switches to the highest priority game when multiple teams are in the redzone
- **Rogers web remote integration**: Controls your TV through the Rogers web remote interface
- **Automatic game discovery**: Automatically maps live games to your configured channels

## Requirements

- Python 3.7+
- Chrome browser
- Rogers account with web remote access
- Internet connection

## Installation

1. **Clone or download the script files**:
   ```bash
   # If you have git
   git clone <repository-url>
   cd remotezone
   
   # Or just download the files to a directory
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install ChromeDriver**:
   - Download ChromeDriver from https://chromedriver.chromium.org/
   - Make sure it matches your Chrome browser version
   - Add it to your PATH or place it in the same directory as the script

## Usage

### Web Interface (Recommended)

1. **Start the web interface**:
   ```bash
   ./start_web.sh
   ```

2. **Open your browser**:
   - Navigate to: `http://localhost:8080`
   - You'll see a beautiful dashboard with all controls

3. **Follow the 3-step process**:
   - **Step 1**: Enter your channel numbers (minimum 2)
   - **Step 2**: Click to open Rogers remote and authenticate
   - **Step 3**: Start monitoring and watch the magic happen!

4. **Monitor in real-time**:
   - See all live games with their redzone status
   - Watch activity logs update live
   - View current channel and monitoring status
   - Stop/start monitoring anytime with one click

### Command Line Interface (Alternative)

1. **Run the script**:
   ```bash
   python nfl_redzone_controller.py
   ```

2. **Configure channels**:
   - Enter at least 2 channel numbers when prompted
   - Channel 1 = Highest Priority
   - Channel 2 = Medium Priority  
   - Channel 3 = Lowest Priority
   - Press Enter to skip additional channels

3. **Authenticate with Rogers**:
   - The script will open your browser to https://rogers.webremote.com/remote
   - Sign in to your Rogers account manually
   - Press Enter in the terminal when authenticated

4. **Monitor and enjoy**:
   - The script will automatically discover live NFL games
   - It will map games to your channels based on priority
   - When a team enters the redzone, it will switch to that game's channel
   - If multiple teams are in the redzone, it will choose the highest priority game

## How It Works

### Game Discovery
1. Fetches all live NFL games from ESPN API
2. Maps games to your configured channels based on priority
3. Displays team names and channel assignments

### Redzone Detection
1. Monitors play-by-play data every 30 seconds
2. Checks `yardsToEndzone` field for each play
3. Triggers channel change when yards < 30

### Channel Control
1. Uses Selenium to control the Rogers web remote
2. Clicks number buttons (NUMBER_0 to NUMBER_9)
3. Confirms channel change with ENTER button
4. Handles multiple digit channel numbers

### Priority System
- **Channel 1**: Highest priority - switches here first
- **Channel 2**: Medium priority - switches here if Channel 1 game not in redzone
- **Channel 3**: Lowest priority - switches here if neither higher priority games are in redzone

## Configuration

### Channel Mapping
The script automatically maps live games to your channels:
- **Game 1** → Channel 1 (Highest Priority)
- **Game 2** → Channel 2 (Medium Priority)
- **Game 3** → Channel 3 (Lowest Priority)

### Monitoring Interval
- Default: 30 seconds between checks
- Can be modified in the code if needed

## Troubleshooting

### Common Issues

1. **ChromeDriver not found**:
   - Download ChromeDriver matching your Chrome version
   - Add to PATH or place in script directory

2. **Authentication fails**:
   - Make sure you're signed into Rogers web remote
   - Check your internet connection
   - Try refreshing the page manually

3. **No games found**:
   - Check if NFL games are currently live
   - Verify ESPN API is accessible
   - Check your internet connection

4. **Channel change fails**:
   - Ensure Rogers web remote is loaded completely
   - Check that the remote is responsive
   - Verify channel numbers are correct

### Logs
The script creates a log file `nfl_redzone_controller.log` with detailed information about:
- Game discovery
- Redzone detection
- Channel changes
- Errors and warnings

## API Endpoints Used

- **Live Games**: `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events`
- **Game Summary**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={EVENT_ID}`
- **Play-by-Play**: `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{EVENT_ID}/competitions/{EVENT_ID}/plays`

## Safety Features

- **Rate limiting**: 30-second intervals prevent API spam
- **Error handling**: Continues running even if individual requests fail
- **Graceful shutdown**: Ctrl+C stops the script cleanly
- **Logging**: All actions are logged for debugging

## Customization

You can modify the script to:
- Change the redzone threshold (currently 30 yards)
- Adjust monitoring intervals
- Add more channels
- Modify priority logic
- Add notifications or alerts

## Disclaimer

This script is for personal use only. Please respect ESPN's API terms of service and Rogers' web remote usage policies. The script is provided as-is without warranty.

## Support

For issues or questions:
1. Check the log file for error details
2. Verify all dependencies are installed
3. Ensure your Rogers account has web remote access
4. Check that NFL games are currently live

Enjoy your automated NFL redzone experience! 🏈

