import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin" | "developer";
  status: string;
  plan_id: string;
  plan_status: string;
  api_key: string | null;
  api_key_status: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  setSession: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: CurrentUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "lexora-auth" }
  )
);
