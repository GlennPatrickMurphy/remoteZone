#!/usr/bin/env python3
"""
NFL Redzone TV Controller - Web Interface

Web-based interface for configuring and monitoring the NFL redzone controller.
"""

import requests
import time
import json
import threading
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from flask import Flask, render_template, request, jsonify, redirect, url_for, g
from flask_cors import CORS
import logging

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nfl_redzone_controller.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Firebase Admin for multi-user authentication
try:
    import firebase_admin
    from firebase_admin import credentials, auth
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed. Multi-user support disabled.")

app = Flask(__name__)
# Enable CORS for all routes (allows Expo web app to connect)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize Firebase Admin (optional - for multi-user support)
firebase_initialized = False
if FIREBASE_AVAILABLE:
    try:
        # Check for Firebase credentials file or use default credentials
        cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Try to use default credentials (e.g., from Cloud Run)
            try:
                firebase_admin.initialize_app()
            except Exception as e:
                logger.warning(f"Firebase Admin initialization failed (non-critical): {e}")
                logger.info("Multi-user support disabled. Server will use single shared controller.")
        
        firebase_initialized = True
        logger.info("Firebase Admin initialized successfully - multi-user support enabled")
    except Exception as e:
        logger.warning(f"Could not initialize Firebase Admin: {e}")
        logger.info("Server will continue with single-user mode (backward compatible)")

def get_user_from_token() -> Optional[str]:
    """Extract and verify Firebase token from request, return user_id"""
    if not firebase_initialized:
        return None
    
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        # Verify token with Firebase
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        logger.debug(f"Authenticated user: {user_id}")
        return user_id
    except Exception as e:
        logger.debug(f"Token verification failed: {e}")
        return None

@dataclass
class Game:
    """Represents a football game (NFL or College Football) with its details"""
    event_id: str
    home_team: str
    away_team: str
    league: str  # 'nfl' or 'college-football'
    # Note: priority and channel are stored client-side in Firebase, not on server
    is_live: bool = False
    possession_team: Optional[str] = None  # Team that currently has the ball (home_team or away_team)
    in_redzone: bool = False
    last_redzone_team: Optional[str] = None
    last_redzone_time: Optional[str] = None
    yards_to_endzone: Optional[int] = None
    play_timestamp: Optional[str] = None
    play_sequence: Optional[str] = None
    last_play_text: Optional[str] = None
    is_timeout: bool = False
    timeout_start_time: Optional[float] = None
    last_timeout_play_sequence: Optional[str] = None  # Track which play had the timeout
    is_end_of_period: bool = False
    home_score: int = 0
    away_score: int = 0
    last_home_score: int = 0
    last_away_score: int = 0
    score_just_changed: bool = False
    score_change_time: Optional[float] = None
    last_score_change_play_sequence: Optional[str] = None  # Track which play had the score change
    quarter: int = 0
    clock_seconds: int = 0
    down: Optional[int] = None  # Current down (1-4)
    distance: Optional[int] = None  # Yards to go (e.g., 1, 10)
    game_excitement_score: float = 0.0  # Calculated by server based on game state

class ESPNClient:
    """Client for interacting with ESPN API v3"""
    
    # League configuration
    LEAGUES = {
        'nfl': {
            'name': 'NFL',
            'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
            'summary_url': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
            'core_url': 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
        },
        'college-football': {
            'name': 'College Football',
            'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
            'summary_url': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary',
            'core_url': 'http://sports.core.api.espn.com/v2/sports/football/leagues/college-football'
        }
    }
    
    def __init__(self, league='nfl'):
        """
        Initialize ESPN client for a specific league
        
        Args:
            league: 'nfl' or 'college-football'
        """
        self.league = league.lower()
        if self.league not in self.LEAGUES:
            logger.warning(f"Unknown league '{league}', defaulting to 'nfl'")
            self.league = 'nfl'
        
        league_config = self.LEAGUES[self.league]
        self.scoreboard_url = league_config['scoreboard_url']
        self.summary_url = league_config['summary_url']
        self.core_url = league_config['core_url']
        self.league_name = league_config['name']
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
    
    def get_live_games(self) -> List[Dict]:
        """Fetch all current games from scoreboard"""
        try:
            response = self.session.get(self.scoreboard_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('events', [])
        except Exception as e:
            logger.error(f"Error fetching live games for {self.league_name}: {e}")
            return []
    
    def get_game_summary(self, event_id: str) -> Optional[Dict]:
        """Get detailed game information including team names and current situation"""
        try:
            url = f"{self.summary_url}?event={event_id}"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching game summary for {event_id} ({self.league_name}): {e}")
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
            logger.error(f"Error fetching game situation for {event_id} ({self.league_name}): {e}")
            return None

# Remote provider URLs
REMOTE_PROVIDERS = {
    'ROGERS': 'https://rogers.webremote.com/remote',
    'XFINITY': 'https://remote.xfinity.com/remote',
    'SHAW': 'https://webremote.shaw.ca/remote',
}


class NFLRedzoneController:
    """Main controller for NFL and College Football game data and excitement score calculation"""
    
    def __init__(self):
        """Initialize controller - supports both NFL and College Football"""
        # Create ESPN clients for both leagues
        self.nfl_client = ESPNClient('nfl')
        self.college_client = ESPNClient('college-football')
    
    
    def get_live_games(self) -> Dict[str, Game]:
        """Fetch all current live games from both NFL and College Football and calculate excitement scores"""
        games: Dict[str, Game] = {}
        
        # Discover NFL games
        nfl_games = self.nfl_client.get_live_games()
        for game_data in nfl_games:
            try:
                # ESPN API v3 returns events with 'id' field, not '$ref'
                event_id = game_data.get('id')
                if not event_id:
                    continue
                
                # Check if game is actually live from the event status
                status = game_data.get('status', {})
                status_type = status.get('type', {})
                is_live = status_type.get('state', '') == 'in'
                
                # Only process live games
                if not is_live:
                    continue
                
                summary = self.nfl_client.get_game_summary(event_id)
                
                if summary and 'boxscore' in summary:
                    teams = summary['boxscore'].get('teams', [])
                    if len(teams) >= 2:
                        home_team = teams[1].get('team', {}).get('displayName', 'Unknown')
                        away_team = teams[0].get('team', {}).get('displayName', 'Unknown')
                        
                        game = Game(
                            event_id=event_id,
                            home_team=home_team,
                            away_team=away_team,
                            league='nfl',
                            is_live=is_live
                        )
                        
                        game_key = f"{away_team} @ {home_team}"
                        games[game_key] = game
            except Exception as e:
                logger.error(f"Error processing NFL game: {e}")
                continue
        
        # Discover College Football games
        college_games = self.college_client.get_live_games()
        for game_data in college_games:
            try:
                # ESPN API v3 returns events with 'id' field, not '$ref'
                event_id = game_data.get('id')
                if not event_id:
                    continue
                
                # Check if game is actually live from the event status
                status = game_data.get('status', {})
                status_type = status.get('type', {})
                is_live = status_type.get('state', '') == 'in'
                
                # Only process live games
                if not is_live:
                    continue
                
                summary = self.college_client.get_game_summary(event_id)
                
                if summary and 'boxscore' in summary:
                    teams = summary['boxscore'].get('teams', [])
                    if len(teams) >= 2:
                        home_team = teams[1].get('team', {}).get('displayName', 'Unknown')
                        away_team = teams[0].get('team', {}).get('displayName', 'Unknown')
                        
                        game = Game(
                            event_id=event_id,
                            home_team=home_team,
                            away_team=away_team,
                            league='college-football',
                            is_live=is_live
                        )
                        
                        game_key = f"{away_team} @ {home_team}"
                        games[game_key] = game
            except Exception as e:
                logger.error(f"Error processing College Football game: {e}")
                continue
        
        # Update game states and calculate excitement scores for all games
        for game_key, game in games.items():
            self.update_game_state(game)
            self.check_redzone_activity(game)
            self.calculate_excitement_score(game)
        
        # Filter to only return live games (safety check)
        live_games = {key: game for key, game in games.items() if game.is_live}
        
        return live_games
    
    def get_all_games_today(self) -> List[Dict]:
        """Get all games for today from both NFL and College Football (not just live ones)"""
        try:
            from datetime import datetime
            today = datetime.now().strftime("%Y%m%d")
            games = []
            
            # Get NFL games
            nfl_url = f"{self.nfl_client.scoreboard_url}?dates={today}"
            response = self.nfl_client.session.get(nfl_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
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
                                    'league': 'nfl',
                                    'status': event.get('status', {}).get('type', {}).get('name', 'Unknown'),
                                    'is_live': event.get('status', {}).get('type', {}).get('state', '') == 'in'
                                })
                except Exception as e:
                    logger.error(f"Error parsing NFL game: {e}")
                    continue
            
            # Get College Football games
            college_url = f"{self.college_client.scoreboard_url}?dates={today}"
            response = self.college_client.session.get(college_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
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
                                    'league': 'college-football',
                                    'status': event.get('status', {}).get('type', {}).get('name', 'Unknown'),
                                    'is_live': event.get('status', {}).get('type', {}).get('state', '') == 'in'
                                })
                except Exception as e:
                    logger.error(f"Error parsing College Football game: {e}")
                    continue
            
            return games
        except Exception as e:
            logger.error(f"Error fetching all games: {e}")
            return []
        
    # Note: Game-to-channel mapping is now handled client-side in Firebase
    
    def update_game_state(self, game: Game) -> None:
        """Update comprehensive game state including scores, timeouts, clock, and possession"""
        # Use the appropriate ESPN client based on game's league
        espn_client = self.nfl_client if game.league == 'nfl' else self.college_client
        
        # Get game summary first (for scores, clock, and possessionText)
        summary = espn_client.get_game_summary(game.event_id)
        
        # Try to get possessionText from summary API first (most reliable)
        possession_text = ''
        if summary:
            try:
                # Path: data["competitions"][0]["situation"]["possessionText"]
                header = summary.get('header', {})
                competitions = header.get('competitions', [])
                if competitions:
                    situation = competitions[0].get('situation', {})
                    possession_text = situation.get('possessionText', '')
            except (KeyError, IndexError, AttributeError) as e:
                logger.debug(f"Could not get possessionText from summary API: {e}")
        
        # Fallback to scoreboard API if summary didn't have possessionText
        situation = None
        if not possession_text:
            situation = espn_client.get_game_situation(game.event_id)
            if situation:
                possession_text = situation.get('possessionText', '')
        
        # If we still don't have situation data, get it from scoreboard for other fields
        if not situation:
            situation = espn_client.get_game_situation(game.event_id)
        
        if not situation and not summary:
            return
        
        # Extract other play information from situation (if available)
        last_play = situation.get('lastPlay', {}) if situation else {}
        team_with_ball = last_play.get('team', {}) if last_play else {}
        
        # Determine which team has possession
        # Method 1: PRIMARY - Use possessionText from ESPN API (shorthand team name like "DAL", "BYU", etc.)
        if possession_text:
            possession_upper = possession_text.upper().strip()
            home_upper = game.home_team.upper()
            away_upper = game.away_team.upper()
            
            # Since possessionText is a shorthand (e.g., "DAL", "BYU"), we need to match it against team names
            # Check if shorthand matches home team (e.g., "DAL" in "Dallas Cowboys")
            if (possession_upper in home_upper or 
                any(word.startswith(possession_upper) for word in home_upper.split() if len(possession_upper) >= 2) or
                any(possession_upper in word for word in home_upper.split() if len(word) >= len(possession_upper))):
                game.possession_team = game.home_team
                logger.debug(f"Determined possession from possessionText: {game.home_team} (text: '{possession_text}')")
            # Check if shorthand matches away team
            elif (possession_upper in away_upper or 
                  any(word.startswith(possession_upper) for word in away_upper.split() if len(possession_upper) >= 2) or
                  any(possession_upper in word for word in away_upper.split() if len(word) >= len(possession_upper))):
                game.possession_team = game.away_team
                logger.debug(f"Determined possession from possessionText: {game.away_team} (text: '{possession_text}')")
        
        # Method 2: Fallback to lastPlay.team if possessionText didn't work
        if not game.possession_team and team_with_ball:
            team_id = team_with_ball.get('id')
            team_name = team_with_ball.get('displayName', '')
            
            # Match team name to home or away team
            if team_name and (team_name in game.home_team or game.home_team in team_name):
                game.possession_team = game.home_team
                logger.debug(f"Determined possession from lastPlay.team: {game.home_team}")
            elif team_name and (team_name in game.away_team or game.away_team in team_name):
                game.possession_team = game.away_team
                logger.debug(f"Determined possession from lastPlay.team: {game.away_team}")
        
        # Method 3: Fallback to parsing last_play_text if other methods didn't work
        if not game.possession_team and last_play:
            play_text = last_play.get('text', '')
            if play_text:
                import re
                # Look for patterns like "to the PSU13", "at DAL20", "to WSH5", etc.
                # Extract team abbreviation from location (e.g., "PSU" from "PSU13")
                location_pattern = r'to\s+(?:the\s+)?([A-Z]{2,4})\d+|at\s+([A-Z]{2,4})\d+'
                match = re.search(location_pattern, play_text, re.IGNORECASE)
                
                if match:
                    # Get the team abbreviation (either from first or second group)
                    team_abbrev = (match.group(1) or match.group(2)).upper()
                    
                    # Match abbreviation against team names
                    home_upper = game.home_team.upper()
                    away_upper = game.away_team.upper()
                    
                    # Check if abbreviation matches home team
                    # Common patterns: "PSU" in "Penn State", "DAL" in "Dallas Cowboys", etc.
                    if (team_abbrev in home_upper or 
                        any(word.startswith(team_abbrev[:2]) for word in home_upper.split() if len(word) >= 2)):
                        # Ball is on home team's side, so away team has possession
                        game.possession_team = game.away_team
                        logger.debug(f"Determined possession from play text: {game.away_team} (ball at {team_abbrev} yard line)")
                    # Check if abbreviation matches away team
                    elif (team_abbrev in away_upper or 
                          any(word.startswith(team_abbrev[:2]) for word in away_upper.split() if len(word) >= 2)):
                        # Ball is on away team's side, so home team has possession
                        game.possession_team = game.home_team
                        logger.debug(f"Determined possession from play text: {game.home_team} (ball at {team_abbrev} yard line)")
        
        # Get game summary for scores and clock (if not already fetched)
        if not summary:
            summary = espn_client.get_game_summary(game.event_id)
        
        if summary:
            header = summary.get('header', {})
            competitions = header.get('competitions', [{}])[0]
            
            # Get scores and detect score changes
            competitors = competitions.get('competitors', [])
            for comp in competitors:
                score = int(comp.get('score', 0))
                if comp.get('homeAway') == 'home':
                    # Check if score changed (compare with current score before updating)
                    if game.home_score != score:
                        # Score changed - track the change
                        game.score_just_changed = True
                        game.score_change_time = time.time()
                        game.last_home_score = game.home_score  # Store previous score
                        # Store the play sequence when score changed (will be set later)
                        logger.info(f"Score changed for {game.home_team} vs {game.away_team}: {game.last_home_score} -> {score} (commercials coming, reducing priority)")
                    game.home_score = score
                else:
                    # Check if score changed (compare with current score before updating)
                    if game.away_score != score:
                        # Score changed - track the change
                        game.score_just_changed = True
                        game.score_change_time = time.time()
                        game.last_away_score = game.away_score  # Store previous score
                        # Store the play sequence when score changed (will be set later)
                        logger.info(f"Score changed for {game.home_team} vs {game.away_team}: {game.last_away_score} -> {score} (commercials coming, reducing priority)")
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
        
        # Get current play ID for tracking
        play_id = last_play.get('id', '')
        
        # Detect timeouts
        if 'timeout' in play_type_text or 'timeout' in play_text:
            if not game.is_timeout:
                game.is_timeout = True
                game.timeout_start_time = time.time()
                game.last_timeout_play_sequence = play_id
                logger.info(f"Timeout detected for {game.home_team} vs {game.away_team} - commercials coming, reducing priority")
        else:
            # No timeout in current play - check if we should clear timeout flag
            if game.is_timeout:
                # Clear timeout if:
                # 1. A new play has occurred (different play sequence) - play has resumed
                # 2. OR timeout has expired (2 minutes - timeouts are usually shorter)
                # 3. OR play text has changed (indicating a new play)
                should_clear = False
                if play_id and game.last_timeout_play_sequence and play_id != game.last_timeout_play_sequence:
                    # New play detected - timeout is over
                    should_clear = True
                    logger.info(f"Timeout cleared for {game.home_team} vs {game.away_team} - new play detected (play resumed)")
                elif game.timeout_start_time and time.time() - game.timeout_start_time > 120:  # 2 minutes (timeouts are usually shorter)
                    # Timeout expired after 2 minutes
                    should_clear = True
                    logger.info(f"Timeout expired for {game.home_team} vs {game.away_team} (2 minutes)")
                elif play_text and hasattr(game, '_last_timeout_play_text') and play_text != game._last_timeout_play_text:
                    # Play text changed - new play occurred, timeout is over
                    should_clear = True
                    logger.info(f"Timeout cleared for {game.home_team} vs {game.away_team} - play text changed (play resumed)")
                
                if should_clear:
                    game.is_timeout = False
                    game.timeout_start_time = None
                    game.last_timeout_play_sequence = None
                    if hasattr(game, '_last_timeout_play_text'):
                        delattr(game, '_last_timeout_play_text')
                else:
                    # Store the play text when timeout occurred to detect changes
                    if not hasattr(game, '_last_timeout_play_text'):
                        game._last_timeout_play_text = play_text
        
        # Check if score change timeout should be cleared
        if game.score_just_changed:
            should_clear_score = False
            # Clear score change flag if:
            # 1. A new play has occurred after the score change (different play sequence) - commercial break is over
            # 2. OR score change timeout has expired (30 seconds - commercial breaks are usually short)
            # 3. OR play text has changed (indicating a new play)
            if play_id and game.last_score_change_play_sequence and play_id != game.last_score_change_play_sequence:
                # New play detected after score change - commercial break is over
                should_clear_score = True
                logger.info(f"Score change commercial cleared for {game.home_team} vs {game.away_team} - new play detected (commercial over)")
            elif game.score_change_time and time.time() - game.score_change_time > 30:  # 30 seconds (commercials are usually short)
                # Score change timeout expired after 30 seconds
                should_clear_score = True
                logger.info(f"Score change timeout expired for {game.home_team} vs {game.away_team} (30 seconds)")
            elif play_text and hasattr(game, '_last_commercial_play_text') and play_text != game._last_commercial_play_text:
                # Play text changed - new play occurred, commercial is over
                should_clear_score = True
                logger.info(f"Score change commercial cleared for {game.home_team} vs {game.away_team} - play text changed (commercial over)")
            
            if should_clear_score:
                game.score_just_changed = False
                game.score_change_time = None
                game.last_score_change_play_sequence = None
                if hasattr(game, '_last_commercial_play_text'):
                    delattr(game, '_last_commercial_play_text')
            else:
                # Store the play text when score changed to detect changes
                if not hasattr(game, '_last_commercial_play_text'):
                    game._last_commercial_play_text = play_text
        
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
        
        # Close game bonus (tiered - heavily favors very close games)
        if score_diff <= 3:
            excitement += 1000  # 0-3 points: 100 points (one possession game!)
        elif score_diff <= 7:
            excitement += 500   # 4-7 points: 50 points (one score game)
        elif score_diff <= 10:
            excitement += 200   # 8-10 points: 20 points (close game)
        elif score_diff <= 14:
            excitement += 50    # 11-14 points: 5 points (somewhat close)
        
        # High scoring bonus
        if total_score > 40:
            excitement += (total_score) *10  # Bonus for high scoring
        
        # Last 15 minutes of 4th quarter bonus
        if game.quarter == 4 and time_remaining_minutes <= 15:
            excitement += (15 - time_remaining_minutes) * 3  # Up to 45 points
        
        game.game_excitement_score = excitement
    
    def check_redzone_activity(self, game: Game) -> Optional[Tuple[str, int]]:
        """Check if any team is in the redzone using ESPN v3 situation data"""
        # Use the appropriate ESPN client based on game's league
        espn_client = self.nfl_client if game.league == 'nfl' else self.college_client
        
        situation = espn_client.get_game_situation(game.event_id)
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
        
        # Parse down and distance from downDistanceText (e.g., "1st & 10", "4th & 2", etc.)
        game.down = None
        game.distance = None
        if down_distance:
            down_distance_lower = down_distance.lower()
            # Parse down
            if '1st' in down_distance_lower or 'first' in down_distance_lower:
                game.down = 1
            elif '2nd' in down_distance_lower or 'second' in down_distance_lower:
                game.down = 2
            elif '3rd' in down_distance_lower or 'third' in down_distance_lower:
                game.down = 3
            elif '4th' in down_distance_lower or 'fourth' in down_distance_lower:
                game.down = 4
            
            # Parse distance (yards to go) - look for "& X" pattern
            import re
            distance_match = re.search(r'&\s*(\d+)', down_distance)
            if distance_match:
                try:
                    game.distance = int(distance_match.group(1))
                except ValueError:
                    pass
        
        # Store play information
        game.play_sequence = play_id
        game.last_play_text = play_text[:100]
        game.play_timestamp = datetime.now().isoformat()
        game.yards_to_endzone = yards_to_endzone
        
        # If score just changed, store the play sequence for tracking (if not already set)
        if game.score_just_changed and not game.last_score_change_play_sequence:
            game.last_score_change_play_sequence = play_id
        
        # Check if this is the same play we saw last time (stale data detection)
        if hasattr(game, '_last_play_id') and game._last_play_id == play_id:
            logger.debug(f"Same play ID {play_id} for {game.home_team}")
        else:
            game._last_play_id = play_id
            logger.debug(f"New play for {game.home_team}: {play_text[:50]}")
        
        # Check if in redzone (< 30 yards to endzone OR ESPN marks it)
        if (yards_to_endzone is not None and yards_to_endzone < 30) or is_redzone_flag:
            # If team_name is still 'Unknown', try to use possession_team as fallback
            if team_name == 'Unknown' and game.possession_team:
                team_name = game.possession_team
                logger.debug(f"Using possession_team as fallback for redzone: {team_name}")
            
            # If still unknown and we have possession_text, try to parse it
            if team_name == 'Unknown' and possession_text:
                # possession_text is usually a shorthand like "DAL", "BAL", etc.
                # Try to match it against home/away team names
                possession_upper = possession_text.upper().strip()
                home_upper = game.home_team.upper()
                away_upper = game.away_team.upper()
                
                # Check if shorthand matches home team
                if (possession_upper in home_upper or 
                    any(word.startswith(possession_upper) for word in home_upper.split() if len(possession_upper) >= 2)):
                    team_name = game.home_team
                    logger.debug(f"Matched possession_text '{possession_text}' to home team: {team_name}")
                # Check if shorthand matches away team
                elif (possession_upper in away_upper or 
                      any(word.startswith(possession_upper) for word in away_upper.split() if len(possession_upper) >= 2)):
                    team_name = game.away_team
                    logger.debug(f"Matched possession_text '{possession_text}' to away team: {team_name}")
            
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
    
    def calculate_excitement_score(self, game: Game) -> None:
        """Calculate excitement score for a single game based on redzone, timeouts, downs, and game state"""
        excitement = 0.0
        
        # Initialize commercial penalty
        commercial_penalty = 0
        
        # Redzone is highest priority
        if game.in_redzone:
            excitement += 1000  # Massive score for redzone
            if game.yards_to_endzone:
                excitement += (30 - game.yards_to_endzone) * 10  # Closer = higher score
            
            # Bonus for 4th and 1 (or short) in redzone - team likely going for it!
            if game.down == 4 and game.distance is not None and game.distance <= 1:
                excitement += 500  # Huge bonus for 4th and 1 in redzone - very exciting!
                logger.info(f"4th and {game.distance} in redzone for {game.home_team} vs {game.away_team} - likely going for it, increasing excitement")
            elif game.down == 4 and game.distance is not None and game.distance <= 3:
                excitement += 300  # Bonus for 4th and short (2-3 yards) in redzone
                logger.info(f"4th and {game.distance} in redzone for {game.home_team} vs {game.away_team} - short yardage, increasing excitement")
            
            # Penalty for timeout or score change (commercials coming!)
            if game.is_timeout:
                commercial_penalty = 500  # Large penalty for timeout = commercials
            elif game.score_just_changed:
                commercial_penalty = 400  # Large penalty for score change = commercials
        
        # Penalty for 4th down when not in redzone (likely punt = commercial after change of possession)
        if game.down == 4 and not game.in_redzone:
            commercial_penalty = max(commercial_penalty, 300)  # Penalty for 4th down punt situation
            logger.info(f"4th down detected (not in redzone) for {game.home_team} vs {game.away_team} - likely punt, reducing excitement")
        
        # Apply commercial penalty
        excitement -= commercial_penalty
        
        # Add base excitement score (close games in 4th quarter)
        # This is already calculated in update_game_state()
        excitement += game.game_excitement_score
        
        # Update the game's excitement score
        game.game_excitement_score = excitement

# User Controller Manager - handles per-user controller instances
class UserControllerManager:
    """Manages per-user NFLRedzoneController instances for multi-device support"""
    
    def __init__(self):
        self.controllers: Dict[str, NFLRedzoneController] = {}
        self.lock = threading.Lock()
    
    def get_controller(self, user_id: str) -> NFLRedzoneController:
        """Get or create a controller for a specific user"""
        with self.lock:
            if user_id not in self.controllers:
                logger.info(f"Creating new controller for user: {user_id}")
                self.controllers[user_id] = NFLRedzoneController()
            return self.controllers[user_id]
    
    def remove_controller(self, user_id: str):
        """Remove a user's controller (e.g., on logout)"""
        with self.lock:
            if user_id in self.controllers:
                controller = self.controllers[user_id]
                controller.stop_monitoring()
                del self.controllers[user_id]
                logger.info(f"Removed controller for user: {user_id}")
    
    def list_users(self) -> List[str]:
        """List all active user IDs"""
        with self.lock:
            return list(self.controllers.keys())

# Global user controller manager
user_controller_manager = UserControllerManager()

# Backward compatibility: Global controller for anonymous/unauthenticated requests
controller = NFLRedzoneController()

def get_controller_for_request() -> NFLRedzoneController:
    """Get the appropriate controller for the current request (user-specific or global)"""
    user_id = get_user_from_token()
    
    if user_id:
        # Multi-user mode: use user-specific controller
        return user_controller_manager.get_controller(user_id)
    else:
        # Single-user mode: use global controller (backward compatible)
        return controller

# Flask Routes

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get current games with excitement scores - fetches fresh data on each request"""
    ctrl = get_controller_for_request()
    
    # Fetch live games and calculate excitement scores on-demand
    games = ctrl.get_live_games()
    
    games_list = [
        {
            **asdict(game),
            'game_name': game_key,
            'last_redzone_time': game.last_redzone_time or 'N/A'
        }
        for game_key, game in games.items()
    ]
    
    return jsonify({
        'games': games_list  # Games include excitement_score, redzone info, scores, league, etc.
    })

# Note: Channel configuration endpoints removed - channels/priorities stored client-side in Firebase

# Note: /api/stop and /api/start endpoints removed - server is stateless and fetches data on-demand

@app.route('/api/refresh_games', methods=['POST'])
def refresh_games():
    """Refresh game list - now just returns success since games are fetched on-demand"""
    # Games are now fetched fresh on each /api/status request, so this endpoint is no longer needed
    # Keeping it for backward compatibility
    return jsonify({'success': True, 'message': 'Games are fetched fresh on each /api/status request'})

@app.route('/api/all_games', methods=['GET'])
def get_all_games():
    """Get all games for today"""
    ctrl = get_controller_for_request()
    games = ctrl.get_all_games_today()
    return jsonify({'games': games})

# Note: Game-to-channel mapping endpoint removed - handled client-side in Firebase

# Note: /api/clear_games endpoint removed - games are fetched fresh on each request, no state to clear

# Note: TV remote/provider endpoints removed - handled client-side in the app

# Note: /api/set_league endpoint removed - server now returns games from both NFL and College Football

# Note: /api/start endpoint removed - server is stateless and fetches data on-demand via /api/status

if __name__ == '__main__':
    print("🏈 NFL Redzone TV Controller")
    print("=" * 50)
    print("Starting web interface in DEBUG mode...")
    print("Open your browser to: http://localhost:8080")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=8080)
