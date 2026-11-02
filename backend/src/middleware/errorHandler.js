import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Log error in development or testing
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle custom AppError / HTTP Errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'APP_ERROR',
      ...(err.details && { details: err.details }),
    });
  }

  // Handle Prisma Concurrency or Record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found or inaccessible' });
  }

  // Default Internal Server Error (without leaking stack trace)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
