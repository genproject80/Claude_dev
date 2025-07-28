import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthManager } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  clientId?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check if user is already authenticated on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = AuthManager.getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Verify token with backend
        const response = await authApi.verify();
        if (response.valid && response.user) {
          setUser(response.user);
        } else {
          // Token is invalid, remove it
          AuthManager.removeToken();
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        // Token might be expired or invalid
        AuthManager.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await authApi.login(email, password);
      
      if (response.user) {
        setUser(response.user);
      } else {
        throw new Error('Login response missing user data');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Re-throw so component can handle the error
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string, 
    email: string, 
    password: string, 
    role?: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await authApi.register(name, email, password, role);
      
      if (response.user) {
        setUser(response.user);
      } else {
        throw new Error('Registration response missing user data');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error; // Re-throw so component can handle the error
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};