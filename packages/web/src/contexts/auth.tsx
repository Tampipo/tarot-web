import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // "admin" | "member"
  status: string; // "active" | "pending"
}

export interface AuthConfig {
  allowSignup: boolean;
}

interface AuthState {
  user: User | null;
  config: AuthConfig | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Registers a pending account. Resolves without a session — approval needed. */
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<AuthConfig>("/auth/config").then((r) => setConfig(r.data)),
      api
        .get<User>("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => setUser(null)),
    ]).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<User>("/auth/login", { email, password });
    setUser(data);
  }

  async function signup(name: string, email: string, password: string) {
    // 202 pending — no session is issued; the user waits for admin approval.
    await api.post("/auth/signup", { name, email, password });
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, config, loading, isAdmin: user?.role === "admin", login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
