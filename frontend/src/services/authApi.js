import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Reusable axios client for auth calls
const apiClient = axios.create({
  baseURL: API_BASE_URL,
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