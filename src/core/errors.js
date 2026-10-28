export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message = 'Method Not Allowed', details = null) {
    super(message, 405, 'METHOD_NOT_ALLOWED', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Rate Limit Exceeded', details = null) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

export class BadGatewayError extends AppError {
  constructor(message = 'Bad Gateway', details = null) {
    super(message, 502, 'BAD_GATEWAY', details);
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = 'Gateway Timeout', details = null) {
    super(message, 504, 'GATEWAY_TIMEOUT', details);
  }
}
