import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import { wsService } from '../services/websocket';
import LoadingScreen from '../components/LoadingScreen';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const persistAuth = (response) => {
    const nextUser = {
      id: response.userId,
      email: response.email,
      name: response.name,
      role: response.role,
    };
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setToken(response.token);
    setUser(nextUser);
  };

  const login = async (email, password) => {
    // If a previous user left a live WebSocket open, kill it before login.
    wsService.disconnect();

    const response = await authApi.login(email, password);
    persistAuth(response);
    return response;
  };

  const register = async (email, password, confirmPassword, name) => {
    // Same guard as login - disconnect any stale session before registering.
    wsService.disconnect();

    const response = await authApi.register(email, password, confirmPassword, name);
    persistAuth(response);
    return response;
  };

  const logout = () => {
    // Disconnect before clearing storage so cleanup calls can still authenticate.
    wsService.disconnect();

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeRoom');
    setToken(null);
    setUser(null);
  };

  const value = { user, token, loading, login, register, logout, isAuthenticated: !!token };

  if (loading) {
    return <LoadingScreen />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
