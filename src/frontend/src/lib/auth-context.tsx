"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AuthUser {
  user_id: string;
  name: string;
  roles: string[];  // role names from DB
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

const MANAGER_ROLES = ["战队队长", "大区总", "销售VP", "督导"];
const ADMIN_ROLES = ["系统管理员"];

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const stored = localStorage.getItem("auth_user");
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(loginId: string, password: string) {
    const res = await api.post<{ access_token: string; user_id: string; name: string; roles: string[] }>(
      "/auth/login",
      { login: loginId, password }
    );
    localStorage.setItem("access_token", res.access_token);
    const authUser: AuthUser = { user_id: res.user_id, name: res.name, roles: res.roles ?? [] };
    localStorage.setItem("auth_user", JSON.stringify(authUser));
    setUser(authUser);
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  }

  const isAdmin = user?.roles.some(r => ADMIN_ROLES.includes(r)) ?? false;
  const isManager = user?.roles.some(r => MANAGER_ROLES.includes(r)) ?? false;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
