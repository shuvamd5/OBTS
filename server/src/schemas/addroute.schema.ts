import { z } from 'zod';
import { ADDROUTE_STATUSES } from '../models/Addroute.js';

const EDITABLE = ADDROUTE_STATUSES.filter((s) => s !== 'Expired') as [string, ...string[]];

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const addrouteCreateSchema = z.object({
  bsid: objectId,
  rid: objectId,
  price: z.coerce.number().finite().nonnegative(),
});

export const addrouteStatusSchema = z.object({
  arstatus: z.enum(EDITABLE),
});

export const addrouteRouteSchema = z.object({
  rid: objectId,
});

export const addroutePriceSchema = z.object({
  price: z.coerce.number().finite().nonnegative(),
});

export const addrouteIdParamSchema = z.object({
  id: objectId,
});