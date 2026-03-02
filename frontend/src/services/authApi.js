import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Reusable axios client for auth calls
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000),
});

// Auth-specific API
export const authApi = {
  login: async (email, password) => {
    try {
      const response = await apiClient.post('/api/auth/login', {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw 'Request timed out. Please try again.';
      }
      throw (
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to login'
      );
    }
  },

  register: async (email, password, confirmPassword, name) => {
    try {
      const response = await apiClient.post('/api/auth/register', {
        email,
        password,
        confirmPassword,
        name,
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw 'Request timed out. Please try again.';
      }
      throw (
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to register'
      );
    }
  },
};

// Default export for any default imports
export default authApi;
