import { z } from 'zod';

export const routeSchema = z.object({
  id: z.string().min(1, 'Route ID is required'),
  name: z.string().min(1, 'Route name is required'),
  pathPrefix: z.string().startsWith('/', 'Path prefix must start with /'),
  targetUrl: z.string().url('Target URL must be a valid URL'),
  targets: z.array(z.string().url()).optional(),
  loadBalancerStrategy: z.enum(['round-robin', 'least-connections']).default('round-robin'),
  healthCheck: z
    .object({
      enabled: z.boolean().default(true),
      path: z.string().default('/health'),
      intervalMs: z.number().default(10000),
      timeoutMs: z.number().default(2000),
      maxFails: z.number().default(3),
    })
    .optional(),
  circuitBreaker: z
    .object({
      enabled: z.boolean().default(true),
      failureThreshold: z.number().default(5),
      successThreshold: z.number().default(2),
      resetTimeoutMs: z.number().default(10000),
    })
    .optional(),
  retry: z
    .object({
      enabled: z.boolean().default(true),
      maxRetries: z.number().default(3),
      initialDelayMs: z.number().default(100),
      maxDelayMs: z.number().default(2000),
    })
    .optional(),
  stripPrefix: z.boolean().default(false),
  authStrategy: z.enum(['none', 'jwt', 'apiKey', 'any']).default('none'),
  rateLimit: z
    .object({
      enabled: z.boolean().default(true),
      maxRequests: z.number().positive().default(100),
      windowSeconds: z.number().positive().default(60),
      algorithm: z.enum(['fixed', 'sliding']).default('sliding'),
      keyBy: z.enum(['ip', 'consumer', 'user', 'auto']).default('auto'),
    })
    .optional(),
  methods: z.array(z.string().transform((m) => m.toUpperCase())).default(['*']),
  timeoutMs: z.number().positive().default(5000),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).optional().default({}),
});

export const updateRouteSchema = routeSchema.partial().omit({ id: true });
