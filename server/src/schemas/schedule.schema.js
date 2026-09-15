import { z } from 'zod';
import { SCHEDULE_STATUSES } from '../models/BusSchedule.js';

const EDITABLE = SCHEDULE_STATUSES.filter((s) => s !== 'expired');

export const scheduleCreateSchema = z.object({
  bid: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bus id'),
  trdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Travelling date must be YYYY-MM-DD'),
  trtime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
});

export const scheduleEditSchema = z
  .object({
    trdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Travelling date must be YYYY-MM-DD').optional(),
    trtime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm').optional(),
  })
  .refine((v) => v.trdate !== undefined || v.trtime !== undefined, {
    message: 'Provide at least one of trdate/trtime',
  });

export const scheduleStatusSchema = z.object({
  bsstatus: z.enum(EDITABLE),
});

export const scheduleIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid schedule id'),
});