import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ServiceKey } from './TenantContext';
import { apiRequest, clearAuthTokens, getAccessToken, setAdminImpersonation, setAuthTokens } from '../lib/api';

export type UserRole = 'superadmin' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  tenantId?: string;
  tenantName?: string;
  enabledServices?: ServiceKey[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authVersion: number;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'nexushq_user';

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    if (!getAccessToken()) return;
    void apiRequest<User>('/auth/me')
      .then((me) => {
        setUser(me);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
        setAuthVersion((value) => value + 1);
      })
      .catch(() => {
        setUser(null);
        clearAuthTokens();
        setAdminImpersonation(null);
        localStorage.removeItem(STORAGE_KEY);
        setAuthVersion((value) => value + 1);
      });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await apiRequest<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      setAdminImpersonation(null);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.user));
      setAuthVersion((value) => value + 1);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthTokens();
    setAdminImpersonation(null);
    localStorage.removeItem(STORAGE_KEY);
    setAuthVersion((value) => value + 1);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, authVersion, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
