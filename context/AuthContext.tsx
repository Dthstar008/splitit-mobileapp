// context/AuthContext.tsx
// Global root auth state — drives the Auth Stack vs Main Tab Stack switch
// in app/_layout.tsx.

import React, { createContext, useContext, useState, useCallback } from 'react';
import * as api from '../services/api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  signup: (input: { fullName: string; email: string; phone: string; password: string }) => Promise<void>;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  // For screens that update the user server-side themselves (Profile's
  // payout wallet save) and just need the local copy to reflect the fresh
  // response, rather than every such update needing its own context method.
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = useCallback(async (input: { fullName: string; email: string; phone: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.signup(input);
      setUser(res.user);
      setToken(res.token);
    } catch (e: any) {
      setError(e?.message ?? 'Signup failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (input: { identifier: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(input);
      setUser(res.user);
      setToken(res.token);
    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, error, signup, login, logout, clearError, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
