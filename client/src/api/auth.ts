import api, { setAccessToken } from "./client";
import type { RegisterPayload, User } from "../types";

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