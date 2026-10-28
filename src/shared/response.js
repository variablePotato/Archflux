export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details = null) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: errorCode,
      details,
      timestamp: new Date().toISOString(),
    },
  });
};
