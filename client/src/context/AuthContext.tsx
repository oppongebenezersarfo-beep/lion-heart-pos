import React, { createContext, useContext, useState, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pos_token');
  });

  const login = async (username: string, password: string) => {
    const response = await authAPI.login(username, password);
    const { token: newToken, user: userData } = response.data;
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('pos_token', newToken);
    localStorage.setItem('pos_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const isCashier = user?.role === 'cashier';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isManager, isCashier }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
