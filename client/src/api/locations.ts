import api from "./client";

export interface LocationDoc {
  _id: string;
  name: string;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const locationsApi = {
  list: () => api.get<{ locations: LocationDoc[] }>("/locations"),

  create: (name: string) => api.post<{ location: LocationDoc }>("/locations", { name }),

  update: (id: string, name: string) =>
    api.patch<{ location: LocationDoc; message?: string }>(`/locations/${id}`, { name }),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/locations/${id}`),
};