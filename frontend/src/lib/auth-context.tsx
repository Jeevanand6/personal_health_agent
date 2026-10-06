"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, AuthResponse, RegisterPayload, loginApi, registerApi, getMeApi } from "./api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "health_copilot_token";
const USER_KEY = "health_copilot_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Helper to persist session in localStorage & cookie
  const setSession = (authToken: string | null, authUser: User | null) => {
    setToken(authToken);
    setUser(authUser);
    if (typeof window !== "undefined") {
      if (authToken && authUser) {
        localStorage.setItem(TOKEN_KEY, authToken);
        localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        // Also set client cookie for middleware/session persistence
        document.cookie = `health_token=${authToken}; path=/; max-age=86400; SameSite=Lax`;
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        document.cookie = "health_token=; path=/; max-age=0;";
      }
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const refreshed = await getMeApi(token);
      setUser(refreshed);
      if (typeof window !== "undefined") {
        localStorage.setItem(USER_KEY, JSON.stringify(refreshed));
      }
    } catch (err) {
      // If token expired or invalid, log out
      setSession(null, null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (typeof window === "undefined") {
        setIsLoading(false);
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);

          // Verify token against /api/auth/me to guarantee freshness
          const verifiedUser = await getMeApi(storedToken);
          setUser(verifiedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
        } catch (err) {
          // Token is expired or server returned 401
          setSession(null, null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const resp: AuthResponse = await loginApi(email, password);
      setSession(resp.access_token, resp.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const resp: AuthResponse = await registerApi(payload);
      setSession(resp.access_token, resp.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setSession(null, null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
