import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const isRefresh = (original?.url ?? "").endsWith("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isRefresh) {
      original._retry = true;
      try {
        const { data } = await api.post<{ accessToken: string }>("/auth/refresh");
        setAccessToken(data.accessToken);
        return api(original);
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

export function serializeError(err: unknown): string {
  if (err instanceof AxiosError) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
    if (err.response?.status) return `Request failed (${err.response.status})`;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

export default api;
