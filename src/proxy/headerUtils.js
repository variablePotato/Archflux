const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/**
  Strips RFC 2616 Hop-by-Hop headers from the header object.
 */
export const sanitizeHeaders = (headers) => {
  const cleanHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      cleanHeaders[lowerKey] = value;
    }
  }
  return cleanHeaders;
};

/**
  Appends proxy metadata headers to the outgoing request headers.
 */
export const prepareProxyHeaders = (req, targetUrl) => {
  const headers = sanitizeHeaders(req.headers);

  const clientIp = req.ip || req.socket.remoteAddress || '';
  const existingForwardedFor = req.headers['x-forwarded-for'];
  headers['x-forwarded-for'] = existingForwardedFor ? `${existingForwardedFor}, ${clientIp}` : clientIp;

  headers['x-forwarded-host'] = req.headers['host'] || '';
  headers['x-forwarded-proto'] = req.protocol || 'http';

  const requestId = req.id || req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  headers['x-request-id'] = requestId;

  const urlObj = new URL(targetUrl);
  headers['host'] = urlObj.host;

  return { headers, requestId };
};
