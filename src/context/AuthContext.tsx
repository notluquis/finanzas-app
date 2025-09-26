import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { logger } from "../lib/logger";

export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};

export type AuthContextType = {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function bootstrap() {
      try {
        logger.info("[auth] bootstrap: solicitando sesión activa");
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) {
          logger.warn("[auth] bootstrap: sin sesión", { status: res.status });
          if (!cancelled) {
            setUser(null);
          }
          return;
        }
        const payload = (await res.json()) as { status: string; user: AuthUser };
        if (!cancelled && payload?.status === "ok") {
          setUser(payload.user);
          logger.info("[auth] bootstrap: sesión válida", payload.user);
        }
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") {
          return;
        }
        logger.error("[auth] bootstrap: error", error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const login = async (email: string, password: string) => {
    logger.info("[auth] login:start", { email });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const payload = (await res.json()) as { status: string; user?: AuthUser; message?: string };
    if (!res.ok || payload.status !== "ok" || !payload.user) {
      logger.warn("[auth] login:error", { email, status: res.status, message: payload.message });
      throw new Error(payload.message || "No se pudo iniciar sesión");
    }

    setUser(payload.user);
    logger.info("[auth] login:success", payload.user);
  };

  const logout = async () => {
    logger.info("[auth] logout:start");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    logger.info("[auth] logout:done");
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    if (user.role === "GOD") return true;
    if (!roles.length) return true;
    return roles.includes(user.role);
  };

  const value = useMemo<AuthContextType>(
    () => ({ user, initializing, login, logout, hasRole }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider.");
  }
  return ctx;
}
