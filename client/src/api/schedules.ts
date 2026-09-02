import api from "./client";
import type { Schedule, ScheduleStatus } from "../types";

export const schedulesApi = {
  list: () => api.get<{ schedules: Schedule[] }>("/schedules"),

  create: (payload: { bid: string; trdate: string; trtime: string }) =>
    api.post<{ schedule: Schedule }>("/schedules", payload),

  update: (id: string, payload: { trdate?: string; trtime?: string }) =>
    api.patch<{ schedule: Schedule; message?: string }>(`/schedules/${id}`, payload),

  updateStatus: (id: string, bsstatus: ScheduleStatus) =>
    api.patch<{ schedule: Schedule; message?: string }>(`/schedules/${id}/status`, { bsstatus }),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/schedules/${id}`),
};