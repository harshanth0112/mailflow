import { ZodError } from 'zod';
import { ApiError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Log error using structured logger with sensitive data redaction
  if (statusCode >= 500) {
    logger.error(`Server Error: ${err.message}`, {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      errorName: err.name,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  }

  // Handle Mongoose CastError or Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier: ${err.value}`;
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate field value entered: ${fields}`;
  }

  // In production, mask unhandled 500 details from leaking internal database/system structure
  if (statusCode === 500 && env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred. Please contact support.';
  }

  const response = {
    success: false,
    statusCode,
    message,
    errors,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

