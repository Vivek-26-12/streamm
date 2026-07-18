import axios from 'axios';

// Fallback to local port if environment variable is not defined
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const client = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Interceptor to inject JWT token in headers
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auth API endpoints
export const authApi = {
  login: (username, password) => client.post('/auth/login', { username, password }),
  validate: () => client.get('/auth/validate'),
  logout: () => client.post('/auth/logout'),
};

// Media API endpoints
export const mediaApi = {
  getMovies: (filters = {}) => client.get('/movies', { params: filters }),
  getMovie: (id) => client.get(`/movie/${id}`),
  triggerScan: () => client.post('/scan'),
};

// Helper for generating auth-signed streaming/poster URLs (for html5 tags)
export const getAuthenticatedMediaUrl = (endpoint) => {
  const token = localStorage.getItem('token');
  const url = `${API_BASE_URL}${endpoint}`;
  if (!token) return url;
  
  // Use appropriate query separator
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${token}`;
};

export default client;
