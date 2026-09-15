import { z } from 'zod';

const townName = z.string().trim().min(1, 'Town is required');

export const routeCreateSchema = z
  .object({
    sp: townName,
    fp: townName,
    distance: z.number().finite().positive(),
    duration: z.string().trim().min(1, 'Duration is required'),
  })
  .refine((v) => v.sp !== v.fp, {
    message: 'Start point and end point must be different towns',
    path: ['fp'],
  });

export const routeEditSchema = z
  .object({
    sp: townName.optional(),
    fp: townName.optional(),
    distance: z.number().finite().positive().optional(),
    duration: z.string().trim().min(1, 'Duration is required').optional(),
  })
  .refine(
    (v) =>
      v.sp !== undefined || v.fp !== undefined || v.distance !== undefined || v.duration !== undefined,
    { message: 'Provide at least one of sp/fp/distance/duration' }
  )
  .refine((v) => !(v.sp !== undefined && v.fp !== undefined && v.sp === v.fp), {
    message: 'Start point and end point must be different towns',
    path: ['fp'],
  });
  
export const checkpointCreateSchema = z.object({
  route: townName,
  price: z.number().finite().nonnegative(),
});

export const checkpointEditSchema = z
  .object({
    route: townName.optional(),
    price: z.number().finite().nonnegative().optional(),
  })
  .refine((v) => v.route !== undefined || v.price !== undefined, {
    message: 'Provide at least one of route/price',
  });

export const routeIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route id'),
});

export const checkpointIdParamSchema = z.object({
  cpid: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid checkpoint id'),
});

export const checkpointRouteIdParamSchema = z.object({
  id: routeIdParamSchema.shape.id,
  cpid: checkpointIdParamSchema.shape.cpid,
});

export const routeStatusSchema = z.object({
  rstatus: z.enum(['pending', 'active', 'inactive']),
});

