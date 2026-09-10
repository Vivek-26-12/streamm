import axios from 'axios';

// Function to resolve backend API base URL dynamically (prioritizes localStorage)
export const getApiBaseUrl = () => {
  let url = localStorage.getItem('custom_api_url') || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Strip trailing slashes
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
};

// Deprecated static export for backwards compatibility
export const API_BASE_URL = getApiBaseUrl();

const client = axios.create();

// Interceptor to inject dynamic baseURL and JWT token
client.interceptors.request.use((config) => {
  config.baseURL = `${getApiBaseUrl()}/api`;
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
  const url = `${getApiBaseUrl()}${endpoint}`;
  if (!token) return url;
  
  // Use appropriate query separator
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${token}`;
};

export default client;
