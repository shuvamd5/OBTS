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

  create: (sp: string, fp: string) =>
    api.post<RouteResponse>("/routes", { sp, fp }),

  update: (id: string, data: { sp?: string; fp?: string }) =>
    api.patch<RouteResponse>(`/routes/${id}`, data),

  addCheckpoint: (id: string, route: string, price: number) =>
    api.post<RouteResponse>(`/routes/${id}/checkpoints`, { route, price }),

  updateCheckpoint: (id: string, cpid: string, data: { route?: string; price?: number }) =>
    api.patch<RouteResponse>(`/routes/${id}/checkpoints/${cpid}`, data),
};