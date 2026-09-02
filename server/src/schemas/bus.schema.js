import { z } from 'zod';
import { BUS_TYPES, BUS_SEATS, BUS_STATUSES, ZONE_CODES, VEHICLE_TYPES } from '../domain/busmeta.js';

const zoneCode = z.string().refine((v) => v in ZONE_CODES, { message: 'Invalid zone code' });
const vehicleType = z.string().refine((v) => v in VEHICLE_TYPES, { message: 'Invalid vehicle type' });
const SEAT_STYLE_INPUTS = ['foldable', 'semi-foldable', 'unfoldable'];

export const busCreateSchema = z.object({
  bcd0: zoneCode,
  bcd1: z.string().trim().regex(/^[0-9]{1,2}$/, 'Zone number must be 1-2 digits'),
  bcd2: vehicleType,
  bno: z.string().trim().regex(/^[0-9]{4}$/, 'Bus number must be exactly 4 digits'),
  bname: z.string().trim().min(1, 'Name is required'),
  btype: z.enum(BUS_TYPES),
  nseat: z.coerce.number().refine((v) => BUS_SEATS.includes(v), { message: 'Invalid seat count' }),
  stype: z.enum(SEAT_STYLE_INPUTS),
});

export const busStatusSchema = z.object({
  bstatus: z.enum(BUS_STATUSES),
});

export const busIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bus id'),
});

export const busOwnerSchema = z.object({
  uid: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid owner id')
    .nullable()
    .optional(),
});