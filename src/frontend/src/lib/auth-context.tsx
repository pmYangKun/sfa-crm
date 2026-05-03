'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import { UserInfo, LoginResponse } from '@/types';

interface AuthContextType {
  user: UserInfo | null;
  /** 当前登录账号名（demo 用，区分 sales01 / manager01 等；user 对象里没有此字段） */
  loginName: string | null;
  loading: boolean;
  login: (loginName: string, password: string) => Promise<void>;
  logout: () => void;
  /** 一键切换角色：原子地用目标账号换 token，不经过 /login 页面 */
  quickSwitchRole: (targetLogin: string, targetPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loginName: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  quickSwitchRole: async () => {},
});

const LOGIN_NAME_KEY = 'login_name';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loginName, setLoginName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedLogin = localStorage.getItem(LOGIN_NAME_KEY);
    if (token) {
      api
        .get<UserInfo>('/auth/me')
        .then((u) => {
          setUser(u);
          if (savedLogin) setLoginName(savedLogin);
        })
        .catch(() => {
          localStorage.removeItem('access_token');
          localStorage.removeItem(LOGIN_NAME_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (loginNameArg: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', {
      login: loginNameArg,
      password,
    });
    localStorage.setItem('access_token', res.access_token);
    localStorage.setItem(LOGIN_NAME_KEY, loginNameArg);
    setUser(res.user);
    setLoginName(loginNameArg);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem(LOGIN_NAME_KEY);
    setUser(null);
    setLoginName(null);
    window.location.href = '/login';
  };

  // 不走"先 logout 再 login"——那会留出一个 user=null 的窗口，
  // (authenticated) layout 的 useEffect 会在那个窗口把用户踢到 /login。
  // 改成：先拿到新 token，再一次性替换 state。
  const quickSwitchRole = async (targetLogin: string, targetPassword: string) => {
    const res = await api.post<LoginResponse>('/auth/login', {
      login: targetLogin,
      password: targetPassword,
    });
    localStorage.setItem('access_token', res.access_token);
    localStorage.setItem(LOGIN_NAME_KEY, targetLogin);
    setUser(res.user);
    setLoginName(targetLogin);
  };

  return (
    <AuthContext.Provider
      value={{ user, loginName, loading, login, logout, quickSwitchRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
