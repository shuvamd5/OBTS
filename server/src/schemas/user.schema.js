import { z } from "zod";
import { USER_ROLES } from "../models/User.js";

export const roleSchema = z.object({
  ustatus: z.enum(USER_ROLES),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user id"),
});

export const listQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
});
