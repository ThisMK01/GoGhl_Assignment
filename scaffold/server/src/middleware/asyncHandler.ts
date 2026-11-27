import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps an async route handler and passes errors to express next(err)
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
