export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found') {
  return new AppError(message, 404);
}

export function badRequest(message = 'Bad request', details = null) {
  return new AppError(message, 400, details);
}

export function validationError(details) {
  return new AppError('Validation failed', 400, details);
}

export function unprocessableEntity(message = 'Unprocessable entity') {
  return new AppError(message, 422);
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    if (err.statusCode === 503 && err.details?.retryAfter) {
      body.retryAfter = err.details.retryAfter;
    }
    return res.status(err.statusCode).json(body);
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  console.error(err);

  return res.status(500).json({
    error: 'Internal server error',
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
