import { AppError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { sendError } from '../shared/response.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload';
    errorCode = 'BAD_REQUEST';
  } else {
    logger.error({ err, reqId: req.id, url: req.originalUrl }, 'Unhandled Application Error');
  }

  const responseDetails = env.NODE_ENV === 'development' ? details || err.stack : details;

  return sendError(res, message, statusCode, errorCode, responseDetails);
};
