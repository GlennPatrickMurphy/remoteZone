// API Configuration
// Automatically detect server URL based on platform and environment

const CLOUD_RUN_URL = 'https://nfl-redzone-server-bnymowbt4q-uc.a.run.app';
// For local development, you can set your machine's IP address here
// Find it with: ifconfig | grep "inet " | grep -v 127.0.0.1
// Example: const LOCAL_DEV_URL = 'http://192.168.1.100:8080';
const LOCAL_DEV_URL = null; // Set to null to always use Cloud Run, or set your dev machine IP

let API_BASE_URL;

if (typeof window !== 'undefined' && window.location) {
  // Web platform
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Web on localhost: use local server if configured, otherwise Cloud Run
    API_BASE_URL = LOCAL_DEV_URL || CLOUD_RUN_URL;
  } else {
    // Production web: use Cloud Run URL
    API_BASE_URL = CLOUD_RUN_URL;
  }
  console.log('🌐 Web platform detected - API URL:', API_BASE_URL);
} else {
  // Mobile platform (iOS/Android)
  // For mobile, localhost doesn't work - use Cloud Run or dev machine IP
  if (__DEV__ && LOCAL_DEV_URL) {
    // Development with local server: use configured dev machine IP
    API_BASE_URL = LOCAL_DEV_URL;
    console.log('📱 Mobile platform - Using local dev server:', API_BASE_URL);
  } else {
    // Default: use Cloud Run (works everywhere)
    API_BASE_URL = CLOUD_RUN_URL;
    console.log('📱 Mobile platform - Using Cloud Run:', API_BASE_URL);
  }
  console.log('📱 Environment:', __DEV__ ? 'Development' : 'Production');
}

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
  SET_LEAGUE: '/api/set_league',
};

// Export for debugging
export { API_BASE_URL };

