import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://10.125.149.225:8000/api/v1';
// const API_BASE_URL = 'http://localhost:8000/api/v1'
export const getBaseUrl = (): string => {
  if (API_BASE_URL) {
    try {
      const parsed = new URL(API_BASE_URL);
      return parsed.origin;
    } catch {
      return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    }
  }
  return 'http://localhost:8000';
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);
