// ============================================================================
// NOT FOUND MIDDLEWARE
// ============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * 404 Not Found handler
 */
export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
