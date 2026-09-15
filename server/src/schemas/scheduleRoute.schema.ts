import { z } from 'zod';
import { ROUTE_STATUSES } from '../models/ScheduleRoute.js';

const EDITABLE = ROUTE_STATUSES.filter((s) => s !== 'expired') as [string, ...string[]];

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const scheduleRouteCreateSchema = z.object({
  bsid: objectId,
  rid: objectId,
  price: z.coerce.number().finite().nonnegative(),
});

export const scheduleRouteStatusSchema = z.object({
  arstatus: z.enum(EDITABLE),
});

export const scheduleRouteRouteSchema = z.object({
  rid: objectId,
});

export const scheduleRoutePriceSchema = z.object({
  price: z.coerce.number().finite().nonnegative(),
});

export const scheduleRouteIdParamSchema = z.object({
  id: objectId,
});