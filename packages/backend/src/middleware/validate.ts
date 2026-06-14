import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 *
 * @example
 * router.post('/tasks', validate(createTaskSchema), controller.create);
 * router.get('/tasks', validate(taskQuerySchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      // Replace raw values with parsed (coerced/defaulted) values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any)[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new ValidationError('Validation failed', err.flatten().fieldErrors),
        );
      } else {
        next(err);
      }
    }
  };
}
