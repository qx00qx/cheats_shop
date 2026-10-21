import { create } from "zustand";
import axios from "axios";
import { AuthAPI, User } from "../api/auth";

type AuthState = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<boolean>;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem("millex_user") || "null"),
  token: localStorage.getItem("millex_token"),

  async login(email, password) {
    const { access_token, user } = await AuthAPI.login(email, password);
    localStorage.setItem("millex_token", access_token);
    localStorage.setItem("millex_user", JSON.stringify(user));
    set({ token: access_token, user });
  },

  async register(email, username, password) {
    const { access_token, user } = await AuthAPI.register(email, username, password);
    localStorage.setItem("millex_token", access_token);
    localStorage.setItem("millex_user", JSON.stringify(user));
    set({ token: access_token, user });
  },

  logout() {
    localStorage.removeItem("millex_token");
    localStorage.removeItem("millex_user");
    set({ token: null, user: null });
  },

  async loadMe() {
    const token = get().token;
    if (!token) return false;

    try {
      const user = await AuthAPI.me();
      if (get().token !== token) return false;
      localStorage.setItem("millex_user", JSON.stringify(user));
      set({ user });
      return true;
    } catch (error) {
      if (get().token !== token) return false;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        get().logout();
        return false;
      }
      console.error("Failed to refresh authenticated user:", error);
      return false;
    }
  },
}));