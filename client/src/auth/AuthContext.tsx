import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as auth from "../api/auth";
import type { UpdateProfilePayload, User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (logid: string, logpass: string) => Promise<void>;
  register: (payload: {
    uname: string;
    uemail: string;
    umobile: string;
    upass: string;
    ugender: string;
  }) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(logid: string, logpass: string) {
    const res = await auth.login(logid, logpass);
    setUser(res.user);
  }

  async function register(payload: {
    uname: string;
    uemail: string;
    umobile: string;
    upass: string;
    ugender: string;
  }) {
    const res = await auth.register(payload);
    setUser(res.user);
  }

  async function updateProfile(payload: UpdateProfilePayload) {
    const updated = await auth.updateMe(payload);
    setUser(updated);
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}