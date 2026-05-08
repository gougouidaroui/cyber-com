import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null);
  const [password, setPassword] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedSessionToken = localStorage.getItem('sessionToken');
    const storedPassword = sessionStorage.getItem('password');

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        if (storedSessionToken) {
          setSessionToken(storedSessionToken);
        }
        if (storedPassword) {
          setPassword(storedPassword);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionToken');
        sessionStorage.removeItem('password');
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData, newSessionToken, userPassword) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (newSessionToken) {
      localStorage.setItem('sessionToken', newSessionToken);
      setSessionToken(newSessionToken);
    }
    sessionStorage.setItem('password', userPassword);
    setUser(userData);
    setPassword(userPassword);
  };

  const logout = async () => {
    console.log('Logging out...');
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sentMessages');
    sessionStorage.removeItem('password');

    console.log('After logout, localStorage:', {
      token: localStorage.getItem('token'),
      sentMessages: localStorage.getItem('sentMessages')
    });

    setUser(null);
    setSessionToken(null);
    setPassword(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, sessionToken, password, setPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}