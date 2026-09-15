import { z } from 'zod';
import { SEAT_STYLES } from '../models/BusType.js';

const seatCount = z
  .coerce.number()
  .int('Seat count must be a whole number')
  .refine((v) => v > 28, 'Seat count must be greater than 28')
  .refine((v) => v % 2 === 1, 'Seat count must be an odd number');

export const busTypeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  seatCount,
  seatStyle: z.enum(SEAT_STYLES),
});

export const busTypeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  seatCount: seatCount.optional(),
  seatStyle: z.enum(SEAT_STYLES).optional(),
});

export const busTypeIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bus type id'),
});