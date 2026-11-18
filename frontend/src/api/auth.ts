import { api } from "./client";

export type User = {
  id: number;
  email: string;
  username: string;
  balance: number;
  discount_percent: number;
  is_admin: boolean;
  is_active: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export const AuthAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),

  register: (email: string, username: string, password: string, referralCode?: string) =>
    api
      .post<AuthResponse>("/auth/register", {
        email,
        username,
        password,
        ...(referralCode ? { referral_code: referralCode } : {}),
      })
      .then((r) => r.data),

  requestPasswordReset: (email: string) =>
    api
      .post<{ message: string }>("/auth/password-reset/request", { email })
      .then((r) => r.data),

  confirmPasswordReset: (token: string, password: string) =>
    api
      .post<{ message: string }>("/auth/password-reset/confirm", { token, password })
      .then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),

  setup2fa: () =>
    api.post<{ secret: string; uri: string }>("/auth/2fa/setup").then((r) => r.data),

  verify2fa: (code: string) =>
    api.post<{ ok: boolean }>("/auth/2fa/verify", null, { params: { code } }).then((r) => r.data),
};