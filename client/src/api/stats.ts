import api from "./client";
import type { AppStats } from "../types";

export const statsApi = {
  get: () => api.get<AppStats>("/stats"),
};