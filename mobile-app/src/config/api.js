// API Configuration
// Your Mac's IP address on the local network
const MAC_IP = '10.0.0.175';

// Always use network IP for iPhone app
export const API_BASE_URL = `http://${MAC_IP}:8080`; // Network IP for physical iPhone

// Instructions:
// 1. Find your Mac's IP address: System Settings > Network > Wi-Fi > Details
// 2. Replace XXX above with your Mac's IP address
// 3. Make sure your Mac's firewall allows connections on port 8080
// 4. Make sure both iPhone and Mac are on the same Wi-Fi network

export const API_ENDPOINTS = {
  STATUS: '/api/status',
  START: '/api/start',
  STOP: '/api/stop',
  CONFIGURE: '/api/configure',
  OPEN_REMOTE: '/api/open_remote',
  CHECK_AUTH: '/api/check_auth',
  TEST_CHANNEL: '/api/test_channel',
  REFRESH_GAMES: '/api/refresh_games',
  ALL_GAMES: '/api/all_games',
  MAP_GAME: '/api/map_game',
  CLEAR_GAMES: '/api/clear_games',
  GET_CONFIG: '/api/get_config',
};

