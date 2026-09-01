import type { User } from "../types";

export const isAdmin = (user?: User | null): user is User => user?.ustatus === "Admin";
export const isManager = (user?: User | null): user is User => user?.ustatus === "Manager";
export const isStaff = (user?: User | null): boolean => isAdmin(user) || isManager(user);