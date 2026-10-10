import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { initSocket, disconnectSocket } from '../services/socketService';
import { usuarioDesdeToken } from '../utils/sesion';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // authcore no tiene /me: la sesión sale del propio JWT (si no expiró)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = usuarioDesdeToken(token);
    if (usuario) {
      setUser(usuario);
      initSocket(token);
    } else {
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const token = await authService.login(username, password);
    const usuario = usuarioDesdeToken(token);
    if (!usuario) throw new Error('authcore devolvió un token sin rol reconocido');
    localStorage.setItem('token', token);
    setUser(usuario);
    initSocket(token);
    return { token, user: usuario };
  };

  // authcore no revoca tokens: cerrar sesión es descartarlo en el navegador
  const logout = async () => {
    disconnectSocket();
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      currentUser: user,
      role: user?.rol,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
