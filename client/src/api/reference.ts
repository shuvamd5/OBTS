import api from "./client";

export const referenceApi = {
  locations: () => api.get<{ locations: string[] }>("/reference/locations"),
};