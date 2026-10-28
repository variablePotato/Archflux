import pg from 'pg';
import { env } from './env.js';
import { logger } from '../core/logger.js';

const { Pool } = pg;

let pool = null;

export const getDbPool = () => {
  if (!pool) {
    pool = new Pool({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }
  return pool;
};

export const connectDb = async () => {
  try {
    const db = getDbPool();
    const client = await db.connect();
    try {
      const res = await client.query('SELECT NOW()');
      logger.info({ time: res.rows[0].now }, 'PostgreSQL connected successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ errMessage: err.message }, '⚠️ PostgreSQL unavailable or database user not found — relying on in-memory store fallback');
  }
};

export const checkDbHealth = async () => {
  try {
    const db = getDbPool();
    const res = await db.query('SELECT 1 AS healthy');
    return res.rows[0]?.healthy === 1;
  } catch (err) {
    logger.error({ err }, 'PostgreSQL health check failed');
    return false;
  }
};

export const closeDbPool = async () => {
  if (pool) {
    logger.info('Closing PostgreSQL pool...');
    await pool.end();
    pool = null;
  }
};
