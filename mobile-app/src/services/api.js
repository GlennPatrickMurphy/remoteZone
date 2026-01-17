import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { auth } from '../config/firebase';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    console.log('🔧 ApiService initialized with baseURL:', this.baseURL);
  }

  async getAuthToken() {
    try {
      // Wait a moment to ensure auth is ready
      if (!auth) {
        console.warn('Auth not initialized yet');
        return null;
      }
      
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return token;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
      // If auth component not registered, return null gracefully
      if (error.message && error.message.includes('not been registered')) {
        console.warn('Auth component not registered yet, will retry on next request');
        return null;
      }
    }
    return null;
  }

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      console.log('🔗 API Request:', url, options.method || 'GET');
      
      // Get Firebase auth token if available
      const token = await this.getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // Add Authorization header if token is available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('📡 API Response:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Success:', endpoint);
      return data;
    } catch (error) {
      console.error('❌ API request failed:', error);
      console.error('   URL:', `${this.baseURL}${endpoint}`);
      console.error('   Error type:', error.constructor.name);
      console.error('   Error message:', error.message);
      
      // If network error and using localhost on mobile, provide helpful message
      if ((error.message.includes('Network request failed') || 
           error.message.includes('Failed to fetch')) && 
          (url.includes('localhost') || url.includes('127.0.0.1'))) {
        console.warn('⚠️  Network request failed to localhost.');
        console.warn('   On mobile devices, localhost refers to the device itself.');
        console.warn('   The app should use Cloud Run URL instead.');
        console.warn('   This should be handled automatically now.');
      }
      
      throw error;
    }
  }

  async getStatus() {
    return this.request(API_ENDPOINTS.STATUS);
  }

  async startMonitoring() {
    return this.request(API_ENDPOINTS.START, { method: 'POST' });
  }

  async stopMonitoring() {
    return this.request(API_ENDPOINTS.STOP, { method: 'POST' });
  }

  async configureChannels(channels) {
    return this.request(API_ENDPOINTS.CONFIGURE, {
      method: 'POST',
      body: JSON.stringify({ channels }),
    });
  }

  async getRecommendedChannel() {
    return this.request('/api/recommended_channel');
  }

  async refreshGames() {
    return this.request(API_ENDPOINTS.REFRESH_GAMES, { method: 'POST' });
  }

  async getAllGames() {
    return this.request(API_ENDPOINTS.ALL_GAMES);
  }

  async mapGame(eventId, channel, priority) {
    return this.request(API_ENDPOINTS.MAP_GAME, {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        channel: parseInt(channel),
        priority: parseInt(priority),
      }),
    });
  }

  async clearGames() {
    return this.request(API_ENDPOINTS.CLEAR_GAMES, { method: 'POST' });
  }

  async getConfig() {
    return this.request(API_ENDPOINTS.GET_CONFIG);
  }

  async setLeague(league) {
    return this.request(API_ENDPOINTS.SET_LEAGUE, {
      method: 'POST',
      body: JSON.stringify({ league }),
    });
  }
}

export default new ApiService();

