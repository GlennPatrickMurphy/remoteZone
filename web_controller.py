#!/usr/bin/env python3
"""
NFL Redzone TV Controller - Web Interface

Web-based interface for configuring and monitoring the NFL redzone controller.
"""

import requests
import time
import json
import threading
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from flask import Flask, render_template, request, jsonify, redirect, url_for
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

app = Flask(__name__)

@dataclass
class Game:
    """Represents an NFL game with its details"""
    event_id: str
    home_team: str
    away_team: str
    channel: int
    priority: int
    is_live: bool = False
    in_redzone: bool = False
    last_redzone_team: Optional[str] = None
    last_redzone_time: Optional[str] = None
    yards_to_endzone: Optional[int] = None
    play_timestamp: Optional[str] = None
    play_sequence: Optional[str] = None
    last_play_text: Optional[str] = None
    is_timeout: bool = False
    timeout_start_time: Optional[float] = None
    is_end_of_period: bool = False
    home_score: int = 0
    away_score: int = 0
    quarter: int = 0
    clock_seconds: int = 0
    game_excitement_score: float = 0.0

class ESPNClient:
    """Client for interacting with ESPN API v3"""
    
    def __init__(self):
        self.scoreboard_url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
        self.summary_url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
    
    def get_live_games(self) -> List[Dict]:
        """Fetch all current NFL games from scoreboard"""
        try:
            response = self.session.get(self.scoreboard_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('events', [])
        except Exception as e:
            logger.error(f"Error fetching live games: {e}")
            return []
    
    def get_game_summary(self, event_id: str) -> Optional[Dict]:
        """Get detailed game information including team names and current situation"""
        try:
            url = f"{self.summary_url}?event={event_id}"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching game summary for {event_id}: {e}")
            return None
    
    def get_game_situation(self, event_id: str) -> Optional[Dict]:
        """Get current game situation from scoreboard (faster than summary)"""
        try:
            # Get from scoreboard for speed
            response = self.session.get(self.scoreboard_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Find the specific game
            for event in data.get('events', []):
                if event.get('id') == event_id:
                    competitions = event.get('competitions', [{}])[0]
                    return competitions.get('situation', {})
            
            return None
        except Exception as e:
            logger.error(f"Error fetching game situation for {event_id}: {e}")
            return None

class RogersRemoteController:
    """Controller for Rogers web remote"""
    
    def __init__(self):
        self.driver = None
        self.wait = None
        self.is_authenticated = False
        self.last_channel = None
    
    def setup_driver(self):
        """Initialize Chrome driver with appropriate options"""
        try:
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.wait = WebDriverWait(self.driver, 10)
            logger.info("ChromeDriver initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize ChromeDriver: {e}")
            raise Exception(f"ChromeDriver error: {str(e)}. Make sure Chrome browser and ChromeDriver are installed.")
    
    def open_rogers_remote(self):
        """Open Rogers web remote"""
        try:
            if not self.driver:
                self.setup_driver()
            self.driver.get("https://rogers.webremote.com/remote")
            logger.info("Opened Rogers web remote.")
            return True
        except Exception as e:
            logger.error(f"Error opening Rogers remote: {e}")
            raise
    
    def check_authenticated(self) -> bool:
        """Check if user is authenticated by looking for remote buttons"""
        try:
            # Check if browser window is still open
            if not self.driver or not self.driver.window_handles:
                logger.error("Browser window was closed")
                self.is_authenticated = False
                self.driver = None
                return False
            
            # Look for a number button to confirm we're on the remote page
            button = self.driver.find_element(By.CSS_SELECTOR, '[data-vcode="NUMBER_1"]')
            self.is_authenticated = True
            return True
        except NoSuchElementException:
            self.is_authenticated = False
            return False
        except Exception as e:
            error_msg = str(e)
            if "no such window" in error_msg or "target window already closed" in error_msg:
                logger.error("Browser window was closed - authentication lost")
                self.is_authenticated = False
                self.driver = None
            return False
    
    def change_channel(self, channel_number: int) -> bool:
        """Change TV channel to specified number"""
        if not self.is_authenticated:
            logger.error("Not authenticated with Rogers remote")
            return False
        
        if self.last_channel == channel_number:
            logger.info(f"Already on channel {channel_number}")
            return True
        
        try:
            # Check if browser window is still open
            if not self.driver or not self.driver.window_handles:
                logger.error("Browser window was closed")
                self.is_authenticated = False
                return False
            
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
                self.last_channel = channel_number
                logger.info(f"Successfully changed channel to {channel_number}")
                return True
            except TimeoutException:
                logger.error("Could not find ENTER button")
                return False
                
        except Exception as e:
            error_msg = str(e)
            if "no such window" in error_msg or "target window already closed" in error_msg:
                logger.error("Browser window was closed - authentication lost")
                self.is_authenticated = False
                self.driver = None
            else:
                logger.error(f"Error changing channel to {channel_number}: {e}")
            return False
    
    def close(self):
        """Close the browser driver"""
        if self.driver:
            self.driver.quit()
            self.driver = None
            self.is_authenticated = False

class NFLRedzoneController:
    """Main controller for NFL redzone monitoring and TV control"""
    
    def __init__(self):
        self.espn_client = ESPNClient()
        self.remote_controller = RogersRemoteController()
        self.games: Dict[str, Game] = {}
        self.channel_mapping: Dict[int, str] = {}
        self.current_channel: Optional[int] = None
        self.is_running = False
        self.monitoring_thread = None
        self.status_logs = []
        self.max_logs = 100
        self.config_file = 'nfl_controller_config.json'
        self.load_configuration()
    
    def add_log(self, message: str, level: str = "info"):
        """Add a log message to the status logs"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.status_logs.append({
            "timestamp": timestamp,
            "level": level,
            "message": message
        })
        # Keep only the last 100 logs
        if len(self.status_logs) > self.max_logs:
            self.status_logs = self.status_logs[-self.max_logs:]
    
    def save_configuration(self):
        """Save current configuration to file"""
        try:
            config = {
                'channels': list(self.channel_mapping.keys()),
                'games': []
            }
            
            # Save game mappings
            for game_key, game in self.games.items():
                config['games'].append({
                    'event_id': game.event_id,
                    'home_team': game.home_team,
                    'away_team': game.away_team,
                    'channel': game.channel,
                    'priority': game.priority
                })
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            
            logger.info(f"Configuration saved to {self.config_file}")
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
    
    def load_configuration(self):
        """Load configuration from file"""
        try:
            import os
            if not os.path.exists(self.config_file):
                logger.info("No saved configuration found")
                return
            
            with open(self.config_file, 'r') as f:
                config = json.load(f)
            
            # Load channels
            if 'channels' in config and config['channels']:
                channels = config['channels']
                self.channel_mapping = {channels[i]: f"game_{i+1}" for i in range(len(channels))}
                logger.info(f"Loaded channels: {channels}")
                self.add_log(f"Loaded saved channels: {', '.join(map(str, channels))}")
            
            # Load game mappings
            if 'games' in config and config['games']:
                for game_data in config['games']:
                    game = Game(
                        event_id=game_data['event_id'],
                        home_team=game_data['home_team'],
                        away_team=game_data['away_team'],
                        channel=game_data['channel'],
                        priority=game_data['priority'],
                        is_live=True
                    )
                    game_key = f"{game.away_team} @ {game.home_team}"
                    self.games[game_key] = game
                    logger.info(f"Loaded game: {game_key} -> Channel {game.channel}")
                
                self.add_log(f"Loaded {len(config['games'])} saved game mappings")
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
    
    def setup_channels(self, channels: List[int]) -> bool:
        """Set up channel mapping"""
        if len(channels) < 2:
            self.add_log("At least 2 channels are required", "error")
            return False
        
        self.channel_mapping = {channels[i]: f"game_{i+1}" for i in range(len(channels))}
        logger.info(f"Channel mapping configured: {self.channel_mapping}")
        self.add_log(f"Configured {len(channels)} channels")
        self.save_configuration()
        return True
    
    def discover_games(self) -> bool:
        """Discover current live games and map them to channels"""
        self.add_log("Discovering live NFL games...")
        live_games_data = self.espn_client.get_live_games()
        
        if not live_games_data:
            self.add_log("No live games found", "warning")
            return False
        
        # Clear existing games
        self.games.clear()
        
        # Get channel priorities
        channels = list(self.channel_mapping.keys())
        channels.sort()  # Lower channel number = higher priority
        
        games_found = 0
        for i, game_data in enumerate(live_games_data[:len(channels)]):
            try:
                event_id = game_data['$ref'].split('/')[-1].split('?')[0]
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
                        self.add_log(f"Mapped {game_key} to channel {channels[i]} (priority {i+1})")
                        games_found += 1
            except Exception as e:
                logger.error(f"Error processing game: {e}")
                continue
        
        self.add_log(f"Discovered {games_found} live games")
        return games_found > 0
    
    def get_all_games_today(self) -> List[Dict]:
        """Get all NFL games for today (not just live ones)"""
        try:
            from datetime import datetime
            today = datetime.now().strftime("%Y%m%d")
            url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={today}"
            response = self.espn_client.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            games = []
            for event in data.get('events', []):
                try:
                    event_id = event['id']
                    competitions = event.get('competitions', [])
                    if competitions:
                        comp = competitions[0]
                        competitors = comp.get('competitors', [])
                        if len(competitors) >= 2:
                            home = next((c for c in competitors if c.get('homeAway') == 'home'), None)
                            away = next((c for c in competitors if c.get('homeAway') == 'away'), None)
                            
                            if home and away:
                                games.append({
                                    'event_id': event_id,
                                    'home_team': home.get('team', {}).get('displayName', 'Unknown'),
                                    'away_team': away.get('team', {}).get('displayName', 'Unknown'),
                                    'status': event.get('status', {}).get('type', {}).get('name', 'Unknown'),
                                    'is_live': event.get('status', {}).get('type', {}).get('state', '') == 'in'
                                })
                except Exception as e:
                    logger.error(f"Error parsing game: {e}")
                    continue
            
            return games
        except Exception as e:
            logger.error(f"Error fetching all games: {e}")
            return []
    
    def map_game_to_channel(self, event_id: str, channel: int, priority: int) -> bool:
        """Manually map a specific game to a channel"""
        try:
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
                        channel=channel,
                        priority=priority,
                        is_live=True
                    )
                    
                    game_key = f"{away_team} @ {home_team}"
                    self.games[game_key] = game
                    self.add_log(f"Mapped {game_key} to channel {channel} (priority {priority})")
                    self.save_configuration()
                    return True
        except Exception as e:
            logger.error(f"Error mapping game: {e}")
            return False
        
        return False
    
    def update_game_state(self, game: Game) -> None:
        """Update comprehensive game state including scores, timeouts, clock"""
        situation = self.espn_client.get_game_situation(game.event_id)
        if not situation:
            return
        
        # Get game summary for scores and clock
        summary = self.espn_client.get_game_summary(game.event_id)
        if summary:
            header = summary.get('header', {})
            competitions = header.get('competitions', [{}])[0]
            
            # Get scores
            competitors = competitions.get('competitors', [])
            for comp in competitors:
                score = int(comp.get('score', 0))
                if comp.get('homeAway') == 'home':
                    game.home_score = score
                else:
                    game.away_score = score
            
            # Get period and clock
            status = competitions.get('status', {})
            game.quarter = status.get('period', 0)
            clock_display = status.get('displayClock', '0:00')
            
            # Convert clock to seconds
            try:
                if ':' in clock_display:
                    parts = clock_display.split(':')
                    game.clock_seconds = int(parts[0]) * 60 + int(parts[1])
                else:
                    game.clock_seconds = 0
            except:
                game.clock_seconds = 0
        
        # Check for timeout or end of period
        last_play = situation.get('lastPlay', {})
        play_type = last_play.get('type', {})
        play_type_text = play_type.get('text', '').lower()
        play_text = last_play.get('text', '').lower()
        
        # Detect timeouts
        if 'timeout' in play_type_text or 'timeout' in play_text:
            if not game.is_timeout:
                game.is_timeout = True
                game.timeout_start_time = time.time()
                logger.info(f"Timeout detected for {game.home_team} vs {game.away_team}")
        else:
            # Check if timeout has expired (3 minutes)
            if game.is_timeout and game.timeout_start_time:
                if time.time() - game.timeout_start_time > 180:  # 3 minutes
                    game.is_timeout = False
                    game.timeout_start_time = None
                    logger.info(f"Timeout expired for {game.home_team} vs {game.away_team}")
        
        # Detect end of period (quarter/half)
        game.is_end_of_period = (game.clock_seconds == 0 or 
                                   'end of' in play_text or 
                                   'end quarter' in play_text or
                                   'end half' in play_text)
        
        # Calculate excitement score (for dynamic priority)
        # Factors: closeness, score total, time remaining
        score_diff = abs(game.home_score - game.away_score)
        total_score = game.home_score + game.away_score
        time_remaining_minutes = game.clock_seconds / 60 if game.clock_seconds else 0
        
        excitement = 0.0
        
        # Close game bonus (within 10 points)
        if score_diff <= 10:
            excitement += (10 - score_diff) * 2  # 0-20 points
        
        # High scoring bonus
        if total_score > 40:
            excitement += (total_score - 40) * 0.5  # Bonus for high scoring
        
        # Last 15 minutes of 4th quarter bonus
        if game.quarter == 4 and time_remaining_minutes <= 15:
            excitement += (15 - time_remaining_minutes) * 3  # Up to 45 points
        
        game.game_excitement_score = excitement
    
    def check_redzone_activity(self, game: Game) -> Optional[Tuple[str, int]]:
        """Check if any team is in the redzone using ESPN v3 situation data"""
        situation = self.espn_client.get_game_situation(game.event_id)
        if not situation:
            game.in_redzone = False
            return None
        
        # Get last play info
        last_play = situation.get('lastPlay', {})
        play_text = last_play.get('text', 'Unknown play')
        play_id = last_play.get('id', 'Unknown')
        
        # Get drive info - this has the ACTUAL field position!
        drive = last_play.get('drive', {})
        drive_end = drive.get('end', {})
        drive_end_text = drive_end.get('text', '')  # e.g., "WSH 11" or "DAL 18"
        
        # Parse field position from drive end text
        # Format is "TEAM YD" where YD is yards from that team's own goal line
        # Example: "WSH 11" = at Washington's 11 yard line = OFFENSIVE TEAM is 11 yards from scoring on Washington
        # Example: "DAL 18" = at Dallas's 18 yard line = OFFENSIVE TEAM is 18 yards from scoring on Dallas
        yards_to_endzone = None
        team_name = 'Unknown'
        team_with_ball_id = None
        
        if drive_end_text:
            parts = drive_end_text.split()
            if len(parts) == 2:
                defending_team_abbrev = parts[0]  # Team whose yard line it is (DEFENDING)
                try:
                    yard_line = int(parts[1])
                    yards_to_endzone = yard_line  # This IS the yards to endzone
                    
                    # Get which team has the ball from the last play
                    team_with_ball_id = last_play.get('team', {}).get('id')
                    
                    # Map team abbreviations to full names
                    # The team whose yard line it is = the DEFENDING team
                    # So the OTHER team has the ball
                    team_abbrev_map = {
                        'DAL': 'Dallas Cowboys',
                        'WSH': 'Washington Commanders',
                        'WAS': 'Washington Commanders',
                        'NYG': 'New York Giants',
                        'DEN': 'Denver Broncos',
                        'IND': 'Indianapolis Colts',
                        'LAC': 'Los Angeles Chargers'
                    }
                    
                    defending_team_name = team_abbrev_map.get(defending_team_abbrev, defending_team_abbrev)
                    
                    # The team WITH the ball is the one NOT defending
                    if defending_team_name in game.home_team or any(abbr in game.home_team.upper() for abbr in [defending_team_abbrev]):
                        # Defending team is home team, so away team has the ball
                        team_name = game.away_team
                    else:
                        # Defending team is away team, so home team has the ball
                        team_name = game.home_team
                    
                except ValueError:
                    pass
        
        # Fallback: use ESPN's isRedZone flag
        is_redzone_flag = situation.get('isRedZone', False)
        possession_text = situation.get('possessionText', '')
        down_distance = situation.get('downDistanceText', '')
        
        # Store play information
        game.play_sequence = play_id
        game.last_play_text = play_text[:100]
        game.play_timestamp = datetime.now().isoformat()
        game.yards_to_endzone = yards_to_endzone
        
        # Check if this is the same play we saw last time (stale data detection)
        if hasattr(game, '_last_play_id') and game._last_play_id == play_id:
            logger.debug(f"Same play ID {play_id} for {game.home_team}")
        else:
            game._last_play_id = play_id
            logger.debug(f"New play for {game.home_team}: {play_text[:50]}")
        
        # Check if in redzone (< 30 yards to endzone OR ESPN marks it)
        if (yards_to_endzone is not None and yards_to_endzone < 30) or is_redzone_flag:
            # Update game status
            game.in_redzone = True
            game.last_redzone_team = team_name
            game.last_redzone_time = datetime.now().strftime("%H:%M:%S")
            
            # Log with details
            logger.info(f"Redzone: {team_name} at {yards_to_endzone} yards - {drive_end_text} - {down_distance}")
            
            return team_name, yards_to_endzone if yards_to_endzone else 20
        else:
            game.in_redzone = False
        
        return None
    
    def determine_target_channel(self) -> Optional[int]:
        """Smart channel selection based on redzone, timeouts, and excitement"""
        
        # First, update all game states
        for game_key, game in self.games.items():
            self.update_game_state(game)
            self.check_redzone_activity(game)
        
        # Build list of potential channels to watch
        candidates = []
        
        for game_key, game in self.games.items():
            score = 0
            reason = []
            
            # Skip if timeout or end of period (unless redzone)
            if game.is_timeout and not game.in_redzone:
                logger.debug(f"Skipping {game_key} - timeout")
                continue
            
            if game.is_end_of_period and not game.in_redzone:
                logger.debug(f"Skipping {game_key} - end of period")
                continue
            
            # Redzone is highest priority
            if game.in_redzone:
                score += 1000  # Massive score for redzone
                reason.append(f"REDZONE {game.last_redzone_team} at {game.yards_to_endzone}yd")
                
                # Bonus for closer to goal
                if game.yards_to_endzone:
                    score += (30 - game.yards_to_endzone) * 10  # Closer = higher score
            
            # Add excitement score (close games in 4th quarter)
            score += game.game_excitement_score
            if game.game_excitement_score > 20:
                score_diff = abs(game.home_score - game.away_score)
                time_min = game.clock_seconds / 60 if game.clock_seconds else 0
                if game.quarter == 4 and time_min <= 15:
                    reason.append(f"Close game Q4 {time_min:.1f}min ({game.home_score}-{game.away_score})")
            
            # Base priority (lower number = higher base priority)
            # Invert so priority 1 gets more points than priority 3
            base_priority_score = (10 - game.priority) * 50
            score += base_priority_score
            
            # If this is current channel, give small bonus (avoid unnecessary switching)
            if self.current_channel == game.channel:
                score += 5
                reason.append("current")
            
            if score > 0:
                candidates.append({
                    'game': game,
                    'game_key': game_key,
                    'channel': game.channel,
                    'score': score,
                    'reason': ' + '.join(reason) if reason else 'active'
                })
        
        if not candidates:
            # No good options - check if current channel has timeout
            if self.current_channel:
                current_game = next((g for g in self.games.values() if g.channel == self.current_channel), None)
                if current_game and (current_game.is_timeout or current_game.is_end_of_period):
                    # Switch to any non-timeout game
                    for game in self.games.values():
                        if not game.is_timeout and not game.is_end_of_period:
                            self.add_log(f"⏸️ Timeout on Ch {self.current_channel} - Switching to Ch {game.channel}")
                            return game.channel
            return None
        
        # Sort by score (highest first)
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        best = candidates[0]
        game = best['game']
        
        # Log the decision
        if game.in_redzone:
            self.add_log(f"🔴 {best['reason']} - Ch {best['channel']} (score: {best['score']:.0f})")
        elif game.game_excitement_score > 20:
            self.add_log(f"🔥 {best['reason']} - Ch {best['channel']} (score: {best['score']:.0f})")
        
        return best['channel']
    
    def monitoring_loop(self):
        """Main monitoring loop"""
        logger.info("Starting NFL redzone monitoring...")
        self.add_log("🏈 Monitoring started!")
        
        while self.is_running:
            try:
                target_channel = self.determine_target_channel()
                
                if target_channel and target_channel != self.current_channel:
                    success = self.remote_controller.change_channel(target_channel)
                    if success:
                        self.current_channel = target_channel
                        self.add_log(f"📺 Changed to channel {target_channel}")
                    else:
                        # Check if authentication was lost due to closed window
                        if not self.remote_controller.is_authenticated:
                            self.add_log(f"⚠️ Browser window closed - Please reopen Rogers remote and re-authenticate", "error")
                        else:
                            self.add_log(f"Failed to change channel to {target_channel}", "error")
                
                # Wait 30 seconds before next check
                time.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                self.add_log(f"Error: {str(e)}", "error")
                time.sleep(30)
        
        self.add_log("Monitoring stopped")
    
    def start_monitoring(self):
        """Start the monitoring loop in a background thread"""
        if self.is_running:
            return False
        
        self.is_running = True
        self.monitoring_thread = threading.Thread(target=self.monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        return True
    
    def stop_monitoring(self):
        """Stop the monitoring loop"""
        self.is_running = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)

# Global controller instance
controller = NFLRedzoneController()

# Flask Routes

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get current status of the controller"""
    games_list = [
        {
            **asdict(game),
            'game_name': game_key,
            'last_redzone_time': game.last_redzone_time or 'N/A'
        }
        for game_key, game in controller.games.items()
    ]
    
    return jsonify({
        'is_running': controller.is_running,
        'is_authenticated': controller.remote_controller.is_authenticated,
        'current_channel': controller.current_channel,
        'games': games_list,
        'logs': controller.status_logs[-20:],  # Last 20 logs
        'saved_channels': list(controller.channel_mapping.keys())  # Include saved channels
    })

@app.route('/api/get_config')
def get_config():
    """Get saved configuration"""
    return jsonify({
        'channels': list(controller.channel_mapping.keys()),
        'has_games': len(controller.games) > 0
    })

@app.route('/api/configure', methods=['POST'])
def configure():
    """Configure channels"""
    data = request.json
    channels = data.get('channels', [])
    
    if controller.setup_channels(channels):
        if controller.discover_games():
            return jsonify({'success': True, 'message': 'Configuration successful'})
        else:
            return jsonify({'success': False, 'message': 'No live games found'})
    else:
        return jsonify({'success': False, 'message': 'Invalid channel configuration'})

@app.route('/api/open_remote', methods=['POST'])
def open_remote():
    """Open Rogers web remote"""
    try:
        success = controller.remote_controller.open_rogers_remote()
        return jsonify({'success': success})
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to open Rogers remote: {error_msg}")
        return jsonify({'success': False, 'error': error_msg})

@app.route('/api/check_auth', methods=['POST'])
def check_auth():
    """Check if authenticated with Rogers"""
    is_auth = controller.remote_controller.check_authenticated()
    return jsonify({'authenticated': is_auth})

@app.route('/api/start', methods=['POST'])
def start_monitoring():
    """Start monitoring"""
    if not controller.remote_controller.is_authenticated:
        return jsonify({'success': False, 'message': 'Not authenticated with Rogers'})
    
    if not controller.games:
        return jsonify({'success': False, 'message': 'No games configured'})
    
    success = controller.start_monitoring()
    return jsonify({'success': success})

@app.route('/api/stop', methods=['POST'])
def stop_monitoring():
    """Stop monitoring"""
    controller.stop_monitoring()
    return jsonify({'success': True})

@app.route('/api/refresh_games', methods=['POST'])
def refresh_games():
    """Refresh game list"""
    success = controller.discover_games()
    return jsonify({'success': success})

@app.route('/api/all_games', methods=['GET'])
def get_all_games():
    """Get all games for today"""
    games = controller.get_all_games_today()
    return jsonify({'games': games})

@app.route('/api/map_game', methods=['POST'])
def map_game():
    """Map a specific game to a channel"""
    data = request.json
    event_id = data.get('event_id')
    channel = data.get('channel')
    priority = data.get('priority')
    
    if not event_id or not channel or not priority:
        return jsonify({'success': False, 'message': 'Missing required parameters'})
    
    success = controller.map_game_to_channel(event_id, int(channel), int(priority))
    return jsonify({'success': success})

@app.route('/api/clear_games', methods=['POST'])
def clear_games():
    """Clear all mapped games"""
    controller.games.clear()
    controller.add_log("Cleared all game mappings")
    return jsonify({'success': True})

@app.route('/api/test_channel', methods=['POST'])
def test_channel():
    """Test changing to a specific channel"""
    data = request.json
    channel = data.get('channel')
    
    if not channel:
        return jsonify({'success': False, 'message': 'No channel provided'})
    
    try:
        channel_num = int(channel)
        if not controller.remote_controller.is_authenticated:
            return jsonify({'success': False, 'message': 'Not authenticated with Rogers remote'})
        
        controller.add_log(f"Testing channel change to {channel_num}...")
        success = controller.remote_controller.change_channel(channel_num)
        
        if success:
            controller.add_log(f"✅ Test successful! Changed to channel {channel_num}")
            return jsonify({'success': True, 'message': f'Successfully changed to channel {channel_num}'})
        else:
            controller.add_log(f"❌ Test failed for channel {channel_num}", "error")
            return jsonify({'success': False, 'message': 'Failed to change channel'})
    except Exception as e:
        error_msg = str(e)
        controller.add_log(f"Error testing channel: {error_msg}", "error")
        return jsonify({'success': False, 'message': error_msg})

if __name__ == '__main__':
    print("🏈 NFL Redzone TV Controller")
    print("=" * 50)
    print("Starting web interface...")
    print("Open your browser to: http://localhost:8080")
    print("=" * 50)
    app.run(debug=False, host='0.0.0.0', port=8080)
