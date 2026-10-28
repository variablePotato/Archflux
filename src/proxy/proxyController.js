import { proxyService } from './proxyService.js';
import { asyncHandler } from '../shared/asyncHandler.js';

export const createProxyHandler = (getTargetUrl, options = {}) => {
  return asyncHandler(async (req, res) => {
    const targetBase = typeof getTargetUrl === 'function' ? getTargetUrl(req) : getTargetUrl;
    
    // Append request path and query parameters
    const targetUrl = new URL(req.url, targetBase).toString();
    
    await proxyService.forward(req, res, targetUrl, options);
  });
};
