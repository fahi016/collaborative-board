import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import { wsService } from '../services/websocket';

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
    // FIX: If a previous user left a live WebSocket open (e.g. navigated away
    // without clicking Exit, or the board component unmounted unexpectedly),
    // kill it before storing the new user's token. This prevents the new user's
    // wsService.connect() call from being skipped by the `if (this.connected) return`
    // guard — which was the root cause of "test1 creates room but WS shows test2".
    wsService.disconnect();

    const response = await authApi.login(email, password);
    persistAuth(response);
    return response;
  };

  const register = async (email, password, confirmPassword, name) => {
    // Same guard as login — disconnect any stale session before registering.
    wsService.disconnect();

    const response = await authApi.register(email, password, confirmPassword, name);
    persistAuth(response);
    return response;
  };

  const logout = () => {
    // FIX: Disconnect WebSocket BEFORE clearing localStorage so that any
    // in-flight leave/cleanup messages can still authenticate with the current token.
    wsService.disconnect();

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeRoom');
    setToken(null);
    setUser(null);
  };

  const value = { user, token, loading, login, register, logout, isAuthenticated: !!token };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="flex items-center gap-3 rounded-xl px-5 py-3" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#555' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <span className="text-sm font-medium" style={{ color: '#888' }}>Loading…</span>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};