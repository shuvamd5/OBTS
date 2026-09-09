import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const bookingSearchSchema = z.object({
  sp: z.string().trim().min(1).max(25),
  fp: z.string().trim().min(1).max(25),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  order: z.enum(['price', 'time']).optional(),
});

export const bookingActionSchema = z.object({
  arid: objectId,
  sno: z.coerce.number().int().positive(),
  sp: z.string().trim().min(1).max(25),
  fp: z.string().trim().min(1).max(25),
});