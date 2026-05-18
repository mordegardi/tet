'use client';

import { authStorage } from '@/lib/auth-storage';
import type { AuthResponse, PublicUser } from '@expense-tracker/shared';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  setSession: (res: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(authStorage.getUser());
    setIsLoading(false);
  }, []);

  const setSession = useCallback((res: AuthResponse) => {
    authStorage.save(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
