import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const appError = error instanceof AppError ? error : null;
  const statusCode = appError?.statusCode ?? 500;
  const message = error instanceof Error ? error.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
  });
};