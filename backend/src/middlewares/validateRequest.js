import { validationError } from './errorHandler.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(validationError(details));
    }

    req.body = result.data;
    return next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(validationError(details));
    }

    req.params = result.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(validationError(details));
    }

    req.query = result.data;
    return next();
  };
}
