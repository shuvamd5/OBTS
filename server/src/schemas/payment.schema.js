import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const paymentCreateSchema = z
  .object({
    ticketId: objectId.optional(),
    bookingRef: objectId.optional(),
    gateway: z.enum(['esewa', 'khalti']).optional(),
  })
  .refine((v) => v.ticketId !== undefined || v.bookingRef !== undefined, {
    message: 'ticketId or bookingRef is required',
    path: ['ticketId'],
  });

export const paymentIdParamSchema = z.object({
  id: objectId,
});

export const paymentCashSchema = z.object({
  ticketId: objectId,
});

export const paymentVerifySchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  status: z.enum(['paid', 'failed']).optional(),
});

export const paymentWebhookSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  status: z.enum(['paid', 'failed']),
});