export class AppError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation error', details: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', details: err.message });
  }
  console.error('[error]', err);
  return res.status(500).json({ message: 'Internal server error' });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}