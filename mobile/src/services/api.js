import * as SecureStore from 'expo-secure-store';

// آدرس سرور - تغییر بده به آدرس Railway خودت
const API_BASE = 'https://kia-dexter-production.up.railway.app';

class ApiService {
  constructor() {
    this.token = null;
  }

  async getToken() {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('auth_token');
    }
    return this.token;
  }

  async setToken(token) {
    this.token = token;
    await SecureStore.setItemAsync('auth_token', token);
  }

  async clearToken() {
    this.token = null;
    await SecureStore.deleteItemAsync('auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'خطا در ارتباط با سرور');
    }

    return data;
  }

  // Auth
  async login(username, password) {
    const data = await this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await this.setToken(data.token);
    return data;
  }

  async register(userData) {
    return await this.request('/api/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    await this.request('/api/logout', { method: 'POST' });
    await this.clearToken();
  }

  async getMe() {
    return await this.request('/api/me');
  }

  // Members (Coach)
  async getMembers() {
    return await this.request('/api/members');
  }

  async createMember(memberData) {
    return await this.request('/api/members', {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  }

  // Plans
  async getPlans() {
    return await this.request('/api/plans');
  }

  async createPlan(planData) {
    return await this.request('/api/plans', {
      method: 'POST',
      body: JSON.stringify(planData),
    });
  }

  // Progress
  async getProgress(userId, year) {
    return await this.request(`/api/progress?user_id=${userId}&year=${year}`);
  }

  // Announcements
  async getAnnouncements() {
    return await this.request('/api/announcements');
  }

  // Stats
  async getStats() {
    return await this.request('/api/overview');
  }
}

export default new ApiService();
