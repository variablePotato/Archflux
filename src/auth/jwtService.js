import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../core/errors.js';

export class JwtService {
  constructor(secret = env.JWT_SECRET) {
    this.secret = secret;
  }

  /**
   * Sign a new JWT token.
   * @param {Object} payload
   * @param {string|number} expiresIn - e.g. '1h', '7d'
   */
  sign(payload, expiresIn = '1h') {
    return jwt.sign(payload, this.secret, { expiresIn });
  }

  /**
   * Verify and decode a JWT token string.
   * @param {string} token
   * @returns {Object} Decoded payload
   */
  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('JWT token has expired');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid JWT token signature');
      }
      throw new UnauthorizedError(`Authentication failed: ${err.message}`);
    }
  }
}

export const jwtService = new JwtService();
