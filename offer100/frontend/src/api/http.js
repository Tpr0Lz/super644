import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const http = axios.create({
  baseURL: '/api'
});

http.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  config.headers = config.headers || {};
  if (authStore.token) {
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    if (!config.headers['X-Active-Identity']) {
      config.headers['X-Active-Identity'] = authStore.activeIdentity;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default http;
