import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/authApi';
import { usersApi } from '../services/usersApi';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (username: string, password_provided: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (userId: string, profileData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const boot = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setCurrentUser(null);
          return;
        }
        const user = await authApi.me();
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (error) {
        console.error('Failed to restore session', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  const login = async (username: string, password_provided: string): Promise<boolean> => {
    try {
      const { token, user } = await authApi.login(username, password_provided);
      localStorage.setItem('authToken', token);
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      if (user.role === 'DROPOFF_SUPERVISOR') {
        navigate('/received');
      } else {
        navigate('/dashboard');
      }
      return true;
    } catch (error) {
      console.error('Login failed', error);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  const updateProfile = async (userId: string, profileData: Partial<User>) => {
    const updated = await usersApi.updateUser(String(userId), profileData);
    if (currentUser && currentUser.id === updated.id) {
      setCurrentUser(updated);
      localStorage.setItem('currentUser', JSON.stringify(updated));
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
