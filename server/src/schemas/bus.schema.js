import { z } from 'zod';
import { BUS_STATUSES } from '../domain/busmeta.js';

const plateNumber = z
  .string()
  .trim()
  .min(1, 'Plate number is required')
  .transform((v) => v.toUpperCase());

const busTypeId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bus type id');

const amenities = z.array(z.string().trim().min(1)).default([]);

export const busCreateSchema = z.object({
  plateNumber,
  busTypeId,
  bname: z.string().trim().min(1, 'Bus name is required'),
  amenities,
});

export const busEditSchema = z.object({
  plateNumber: plateNumber.optional(),
  busTypeId: busTypeId.optional(),
  bname: z.string().trim().min(1, 'Bus name is required').optional(),
  amenities: amenities.optional(),
});

export const busStatusSchema = z.object({
  bstatus: z.enum(BUS_STATUSES),
});

export const busIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bus id'),
});

export const busOwnerSchema = z.object({
  uid: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid owner id').nullable().optional(),
});