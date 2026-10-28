import crypto from 'crypto';
import { getDbPool } from '../config/db.js';
import { logger } from '../core/logger.js';

export class ApiKeyRepository {
  constructor() {
    /** @type {Map<string, Object>} In-memory store for fast fallback / testing */
    this.memoryKeys = new Map();
  }

  /**
   * Hash API key string with SHA-256.
   */
  hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Create & store a new API Key.
   * Returns plain text key once for client.
   */
  async createApiKey(name, clientOwnerId) {
    const rawKey = `gw_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);

    const record = {
      id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name,
      clientOwnerId,
      keyHash,
      enabled: true,
      createdAt: new Date(),
    };

    // Save to memory store
    this.memoryKeys.set(keyHash, record);

    // Persist to Postgres if database pool is available
    try {
      const db = getDbPool();
      await db.query(
        `CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          client_owner_id VARCHAR(128) NOT NULL,
          key_hash VARCHAR(128) UNIQUE NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
      );

      await db.query(
        `INSERT INTO api_keys (id, name, client_owner_id, key_hash, enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key_hash) DO NOTHING;`,
        [record.id, record.name, record.clientOwnerId, record.keyHash, record.enabled]
      );
    } catch (err) {
      logger.warn({ err }, 'Could not persist API key to PostgreSQL, relying on in-memory cache');
    }

    return { rawKey, record };
  }

  /**
   * Find API key record by raw key string.
   */
  async findByKey(rawKey) {
    const keyHash = this.hashKey(rawKey);

    // 1. Check in-memory store
    if (this.memoryKeys.has(keyHash)) {
      return this.memoryKeys.get(keyHash);
    }

    // 2. Query PostgreSQL
    try {
      const db = getDbPool();
      const res = await db.query('SELECT * FROM api_keys WHERE key_hash = $1 AND enabled = true', [keyHash]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const record = {
          id: row.id,
          name: row.name,
          clientOwnerId: row.client_owner_id,
          keyHash: row.key_hash,
          enabled: row.enabled,
        };
        this.memoryKeys.set(keyHash, record);
        return record;
      }
    } catch (err) {
      logger.warn({ err }, 'Error querying API Key from PostgreSQL');
    }

    return null;
  }

  clear() {
    this.memoryKeys.clear();
  }
}

export const apiKeyRepository = new ApiKeyRepository();
