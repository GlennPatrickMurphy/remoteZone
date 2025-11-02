import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
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
}

export default new ApiService();

