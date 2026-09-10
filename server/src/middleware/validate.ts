import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export interface ValidatedRequest extends Request {
  validated?: Record<string, unknown>;
}

export function validate<T>(
  schema: z.ZodType<T>,
  source: keyof Pick<Request, 'body' | 'query' | 'params'> = 'body'
) {
  return (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        message: 'Validation failed',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    if (!req.validated) req.validated = {};
    req.validated[source] = result.data;
    next();
  };
}