import { z } from 'zod';

const townName = z.string().trim().min(1, 'Town name is required');

export const locationCreateSchema = z.object({ name: townName });
export const locationUpdateSchema = z.object({ name: townName });

export const locationIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid location id'),
});