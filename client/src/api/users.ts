import api from "./client";
import type { User, UserRole } from "../types";

export const usersApi = {
  list: (role?: UserRole) =>
    api.get<{ users: User[] }>("/users", { params: role ? { role } : {} }),

  changeRole: (id: string, ustatus: UserRole) =>
    api.patch<{ user: User; message: string }>(`/users/${id}/role`, { ustatus }),
};