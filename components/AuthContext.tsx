import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserRole } from '@/types';
import { getProfile } from '@/services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  role: UserRole;
  login: (userData: any, userRole: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getProfile(token)
        .then(user => {
          login(user, user.role);
        })
        .catch(() => {
          // Token is invalid or expired, so log the user out
          logout();
        });
    }
  }, []);

  const login = (userData: any, userRole: UserRole) => {
    setUser(userData);
    setRole(userRole);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    setRole(UserRole.STUDENT);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

