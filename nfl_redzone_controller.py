#!/usr/bin/env python3
"""
NFL Redzone TV Controller

This script monitors NFL games for redzone activity and automatically
changes TV channels based on priority when teams are in the redzone.
"""

import requests
import time
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nfl_redzone_controller.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Game:
    """Represents an NFL game with its details"""
    event_id: str
    home_team: str
    away_team: str
    channel: int
    priority: int
    is_live: bool = False
    last_redzone_team: Optional[str] = None
    last_redzone_time: Optional[datetime] = None

@dataclass
class Play:
    """Represents a single play in a game"""
    yards_to_endzone: Optional[int]
    team: str
    play_id: str
    timestamp: datetime

class ESPNClient:
    """Client for interacting with ESPN API"""
    
    def __init__(self):
        self.base_url = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
        self.site_url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
    
    def get_live_games(self) -> List[Dict]:
        """Fetch all current NFL games"""
        try:
            url = f"{self.base_url}/events"
            response = self.session.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get('items', [])
        except Exception as e:
            logger.error(f"Error fetching live games: {e}")
            return []
    
    def get_game_summary(self, event_id: str) -> Optional[Dict]:
        """Get detailed game information including team names"""
        try:
            url = f"{self.site_url}/summary?event={event_id}"
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching game summary for {event_id}: {e}")
            return None
    
    def get_play_by_play(self, event_id: str) -> List[Dict]:
        """Get play-by-play data for a specific game"""
        try:
            url = f"{self.base_url}/events/{event_id}/competitions/{event_id}/plays"
            response = self.session.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get('items', [])
        except Exception as e:
            logger.error(f"Error fetching play-by-play for {event_id}: {e}")
            return []

class RogersRemoteController:
    """Controller for Rogers web remote"""
    
    def __init__(self):
        self.driver = None
        self.wait = None
        self.is_authenticated = False
    
    def setup_driver(self):
        """Initialize Chrome driver with appropriate options"""
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 10)
    
    def open_rogers_remote(self):
        """Open Rogers web remote and wait for authentication"""
        try:
            self.driver.get("https://rogers.webremote.com/remote")
            logger.info("Opened Rogers web remote. Please authenticate manually.")
            
            # Wait for user to authenticate
            input("Press Enter after you have authenticated on the Rogers web remote...")
            self.is_authenticated = True
            logger.info("Authentication confirmed.")
            
        except Exception as e:
            logger.error(f"Error opening Rogers remote: {e}")
            raise
    
    def change_channel(self, channel_number: int) -> bool:
        """Change TV channel to specified number"""
        if not self.is_authenticated:
            logger.error("Not authenticated with Rogers remote")
            return False
        
        try:
            # Convert channel number to individual digits
            channel_str = str(channel_number)
            logger.info(f"Changing channel to {channel_number}")
            
            # Press each digit button
            for digit in channel_str:
                button_id = f"NUMBER_{digit}"
                try:
                    button = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, f'[data-vcode="{button_id}"]'))
                    )
                    button.click()
                    time.sleep(0.5)  # Small delay between button presses
                except TimeoutException:
                    logger.error(f"Could not find button for digit {digit}")
                    return False
            
            # Press ENTER to confirm channel change
            try:
                enter_button = self.wait.until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-vcode="ENTER"]'))
                )
                enter_button.click()
                logger.info(f"Successfully changed channel to {channel_number}")
                return True
            except TimeoutException:
                logger.error("Could not find ENTER button")
                return False
                
        except Exception as e:
            logger.error(f"Error changing channel to {channel_number}: {e}")
            return False
    
    def close(self):
        """Close the browser driver"""
        if self.driver:
            self.driver.quit()

class NFLRedzoneController:
    """Main controller for NFL redzone monitoring and TV control"""
    
    def __init__(self):
        self.espn_client = ESPNClient()
        self.remote_controller = RogersRemoteController()
        self.games: Dict[str, Game] = {}
        self.channel_mapping: Dict[int, str] = {}  # channel -> game_key
        self.current_channel: Optional[int] = None
    
    def setup_channel_mapping(self):
        """Set up channel mapping based on user input"""
        print("\n=== Channel Configuration ===")
        print("Enter channel numbers for games (minimum 2 channels required)")
        print("Priority: Channel 1 = Highest Priority, Channel 3 = Lowest Priority")
        
        channels = []
        for i in range(3):
            channel = input(f"Enter channel {i+1} (or press Enter to skip): ").strip()
            if channel:
                try:
                    channels.append(int(channel))
                except ValueError:
                    print("Invalid channel number. Please enter a number.")
                    i -= 1  # Retry this iteration
            else:
                break
        
        if len(channels) < 2:
            raise ValueError("At least 2 channels are required")
        
        self.channel_mapping = {channels[i]: f"game_{i+1}" for i in range(len(channels))}
        logger.info(f"Channel mapping configured: {self.channel_mapping}")
    
    def discover_games(self):
        """Discover current live games and map them to channels"""
        live_games = self.espn_client.get_live_games()
        if not live_games:
            logger.warning("No live games found")
            return
        
        # Get channel priorities
        channels = list(self.channel_mapping.keys())
        channels.sort()  # Lower channel number = higher priority
        
        for i, game_data in enumerate(live_games[:len(channels)]):
            event_id = game_data['$ref'].split('/')[-1]
            summary = self.espn_client.get_game_summary(event_id)
            
            if summary and 'boxscore' in summary:
                teams = summary['boxscore'].get('teams', [])
                if len(teams) >= 2:
                    home_team = teams[1].get('team', {}).get('displayName', 'Unknown')
                    away_team = teams[0].get('team', {}).get('displayName', 'Unknown')
                    
                    game = Game(
                        event_id=event_id,
                        home_team=home_team,
                        away_team=away_team,
                        channel=channels[i],
                        priority=i + 1,
                        is_live=True
                    )
                    
                    game_key = f"{away_team} @ {home_team}"
                    self.games[game_key] = game
                    logger.info(f"Mapped {game_key} to channel {channels[i]} (priority {i+1})")
        
        logger.info(f"Discovered {len(self.games)} games")
    
    def check_redzone_activity(self, game: Game) -> Optional[str]:
        """Check if any team is in the redzone for a given game"""
        plays = self.espn_client.get_play_by_play(game.event_id)
        if not plays:
            return None
        
        # Get the most recent play
        latest_play = plays[-1] if plays else None
        if not latest_play:
            return None
        
        # Check yards to endzone
        yards_to_endzone = latest_play.get('yardsToEndzone')
        if yards_to_endzone is not None and yards_to_endzone < 30:
            # Determine which team is in the redzone
            # This is a simplified approach - you might need to enhance this
            # based on the actual API response structure
            team_info = latest_play.get('team', {})
            team_name = team_info.get('displayName', 'Unknown')
            
            # Check if this is a new redzone entry (avoid spam)
            if (game.last_redzone_team != team_name or 
                not game.last_redzone_time or 
                (datetime.now() - game.last_redzone_time).seconds > 60):
                
                game.last_redzone_team = team_name
                game.last_redzone_time = datetime.now()
                return team_name
        
        return None
    
    def determine_target_channel(self) -> Optional[int]:
        """Determine which channel to switch to based on redzone activity"""
        redzone_games = []
        
        for game_key, game in self.games.items():
            redzone_team = self.check_redzone_activity(game)
            if redzone_team:
                redzone_games.append((game.priority, game.channel, game_key, redzone_team))
        
        if not redzone_games:
            return None
        
        # Sort by priority (lower number = higher priority)
        redzone_games.sort(key=lambda x: x[0])
        
        # Return the highest priority game's channel
        target_channel = redzone_games[0][1]
        game_info = redzone_games[0][2]
        team = redzone_games[0][3]
        
        logger.info(f"Redzone detected: {team} in {game_info} -> switching to channel {target_channel}")
        return target_channel
    
    def run_monitoring_loop(self):
        """Main monitoring loop"""
        logger.info("Starting NFL redzone monitoring...")
        
        try:
            while True:
                target_channel = self.determine_target_channel()
                
                if target_channel and target_channel != self.current_channel:
                    success = self.remote_controller.change_channel(target_channel)
                    if success:
                        self.current_channel = target_channel
                    else:
                        logger.error(f"Failed to change channel to {target_channel}")
                
                # Wait 30 seconds before next check
                time.sleep(30)
                
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
    
    def run(self):
        """Main entry point"""
        try:
            # Setup
            self.setup_channel_mapping()
            self.remote_controller.setup_driver()
            self.remote_controller.open_rogers_remote()
            
            # Discover games
            self.discover_games()
            if not self.games:
                logger.error("No games found. Exiting.")
                return
            
            # Start monitoring
            self.run_monitoring_loop()
            
        except Exception as e:
            logger.error(f"Fatal error: {e}")
        finally:
            self.remote_controller.close()

if __name__ == "__main__":
    controller = NFLRedzoneController()
    controller.run()

