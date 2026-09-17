import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);

// Express query strings arrive as strings; repeated keys arrive as arrays.
const toArray = (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
const toOptional = (v) => (v === '' || v === undefined || v === null ? undefined : v);
const toOptionalNumber = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));
const toSnoArray = (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export const bookingSearchSchema = z
  .object({
    sp: z.string().trim().min(1).max(25),
    fp: z.string().trim().min(1).max(25),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    time: timeString.optional(),
    order: z.enum(['price', 'time', 'arrival', 'rating']).optional(),
    busType: z.preprocess(toArray, z.array(objectId).max(30).optional()),
    amenities: z.preprocess(
      toArray,
      z.array(z.string().trim().toLowerCase().min(1)).max(20).optional()
    ),
    stops: z.preprocess(toArray, z.array(z.string().trim().min(1).max(25)).max(20).optional()),
    minPrice: z.preprocess(toOptionalNumber, z.number().finite().nonnegative().optional()),
    maxPrice: z.preprocess(toOptionalNumber, z.number().finite().nonnegative().optional()),
    fromTime: z.preprocess(toOptional, timeString.optional()),
    toTime: z.preprocess(toOptional, timeString.optional()),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'minPrice must not exceed maxPrice',
    path: ['minPrice'],
  })
  .refine((v) => v.fromTime === undefined || v.toTime === undefined || v.fromTime <= v.toTime, {
    message: 'fromTime must not be after toTime',
    path: ['fromTime'],
  });

export const bookingActionSchema = z.object({
  arid: objectId,
  sno: z.preprocess(
    toSnoArray,
    z.array(z.coerce.number().int().positive()).nonempty('at least one seat is required').max(12)
  ),
  sp: z.string().trim().min(1).max(25),
  fp: z.string().trim().min(1).max(25),
});

export const seatActionSchema = z.object({
  arid: objectId,
  sno: z.coerce.number().int().positive(),
  sp: z.string().trim().min(1).max(25),
  fp: z.string().trim().min(1).max(25),
});