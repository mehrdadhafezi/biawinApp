import { z } from 'zod';

/**
 * Fails fast at bootstrap if a required environment variable is missing or
 * malformed, instead of surfacing an obscure error the first time that
 * variable is used at runtime (see docs/01-architecture.md, review item 2).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),

  SIGNUP_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  STORAGE_ENDPOINT: z.string().min(1, 'STORAGE_ENDPOINT is required'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().min(1, 'STORAGE_ACCESS_KEY is required'),
  STORAGE_SECRET_KEY: z.string().min(1, 'STORAGE_SECRET_KEY is required'),
  STORAGE_BUCKET: z.string().min(1, 'STORAGE_BUCKET is required'),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // --- Staging-only OTP test bypass (docs/08-staging-deployment.md). Must
  // never be "true" in a real production .env — NODE_ENV=development already
  // covers local dev regardless of this flag.
  // NOTE: intentionally NOT z.coerce.boolean() — Boolean("false") is `true` in
  // JS, which would silently invert an operator's intent to disable this.
  STAGING_TEST_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // --- SMS provider (notifications module) — all optional; falls back to
  // MockSmsProvider when SMS_PROVIDER isn't "faraz" or credentials are absent.
  SMS_PROVIDER: z.enum(['mock', 'faraz']).default('mock'),
  FARAZ_API_URL: z.string().optional(),
  FARAZ_USERNAME: z.string().optional(),
  FARAZ_PASSWORD: z.string().optional(),
  FARAZ_SENDER: z.string().optional(),

  // --- Payment provider (payments module) — architecture only, not yet
  // called from any business flow; optional so dev/CI never need real merchant IDs.
  PAYMENT_PROVIDER: z.enum(['zibal', 'zarinpal']).default('zibal'),
  ZIBAL_MERCHANT_ID: z.string().optional(),
  ZARINPAL_MERCHANT_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/** Passed to ConfigModule.forRoot({ validate }) — throws on invalid config. */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
