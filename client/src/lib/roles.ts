import type { User } from "../types";

export const isAdmin = (user?: User | null): user is User => user?.ustatus === "admin";
export const isOperator = (user?: User | null): user is User => user?.ustatus === "operator";
export const isChecker = (user?: User | null): user is User => user?.ustatus === "checker";
export const isStaff = (user?: User | null): boolean => isAdmin(user) || isOperator(user);