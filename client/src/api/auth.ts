import api, { setAccessToken } from "./client";
import type { RegisterPayload, UpdateProfilePayload, User } from "../types";

interface AuthResponse {
  message: string;
  accessToken: string;
  user: User;
}

export async function login(logid: string, logpass: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { logid, logpass });
  setAccessToken(data.accessToken);
  return data;
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  setAccessToken(data.accessToken);
  return data;
}

export async function updateMe(payload: UpdateProfilePayload) {
  const { data } = await api.patch<{ message: string; user: User }>("/auth/me", payload);
  return data.user;
}

export async function getMe() {
  const { data } = await api.get<{ user: User }>("/auth/me");
  return data.user;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

export async function forgotPassword(uemail: string) {
  const { data } = await api.post<{ message: string }>("/auth/forgot-password", { uemail });
  return data;
}

export async function resetPassword(token: string, upass: string) {
  const { data } = await api.post<{ message: string }>(`/auth/reset-password/${token}`, { upass });
  return data;
}