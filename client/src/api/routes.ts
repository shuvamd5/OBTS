import api from "./client";
import type { Route } from "../types";

interface RouteResponse {
  route: Route;
  message?: string;
}

interface RoutesResponse {
  routes: Route[];
}

export const routesApi = {
  list: () => api.get<RoutesResponse>("/routes"),

  create: (sp: string, fp: string, distance: number, duration: string) =>
    api.post<RouteResponse>("/routes", { sp, fp, distance, duration }),

  update: (id: string, data: { sp?: string; fp?: string; distance?: number; duration?: string }) =>
    api.patch<RouteResponse>(`/routes/${id}`, data),

  updateStatus: (id: string, rstatus: Route["rstatus"]) =>
    api.patch<RouteResponse>(`/routes/${id}/status`, { rstatus }),

  addCheckpoint: (id: string, route: string, price: number) =>
    api.post<RouteResponse>(`/routes/${id}/checkpoints`, { route, price }),

  updateCheckpoint: (id: string, cpid: string, data: { route?: string; price?: number }) =>
    api.patch<RouteResponse>(`/routes/${id}/checkpoints/${cpid}`, data),

  remove: (id: string) =>
    api.delete<{ message: string; id: string }>(`/routes/${id}`),

  removeCheckpoint: (id: string, cpid: string) =>
    api.delete<{ message: string; route: Route }>(`/routes/${id}/checkpoints/${cpid}`),
};