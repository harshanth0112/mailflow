import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CLIENT_URL: z
    .string()
    .url()
    .default('http://localhost:5173'),
  API_BASE_URL: z.string().url().optional(),
  MONGODB_URI: z
    .string()
    .optional()
    .default(''),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('7d'),
  ENCRYPTION_KEY: z.string().optional(),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).optional(),
  QUEUE_FEATURES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EMAIL_PROVIDER: z.enum(['resend', 'sendliberty', 'smtp', 'console', 'disabled']).optional(),
  RESEND_API_KEY: z.string().optional().default(''),
  SENDLIBERTY_API_KEY: z.string().optional().default(''),
  SENDLIBERTY_FROM_EMAIL: z.string().optional().default(''),
  CAMPAIGN_EMAIL_PROVIDER: z.enum(['mailbox', 'sendliberty']).default('mailbox'),
  SMTP_HOST: z
    .string()
    .optional()
    .default('smtp.gmail.com'),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  SMTP_USER: z
    .string()
    .optional()
    .default(''),
  SMTP_PASS: z
    .string()
    .optional()
    .default(''),
  SMTP_FROM_EMAIL: z
    .string()
    .optional()
    .default(''),
  SMTP_FROM_NAME: z
    .string()
    .default('MailFlow Team'),
  // OAuth Providers (Optional in dev, but fully configured)
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().url().optional().default('http://localhost:5000/api/v1/auth/oauth/google/callback')
    ),
  GMAIL_SENDER_CALLBACK_URL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().url().optional().default('http://localhost:5000/api/v1/email-accounts/oauth/google/callback')
    ),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CALLBACK_URL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().url().optional().default('http://localhost:5000/api/v1/auth/oauth/github/callback')
    ),
  MICROSOFT_CLIENT_ID: z.string().optional().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(''),
  MICROSOFT_CALLBACK_URL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().url().optional().default('http://localhost:5000/api/v1/auth/oauth/microsoft/callback')
    ),
  // Redis & Queue Configuration
  REDIS_URL: z.string().optional().default(''),
  REDIS_HOST: z.string().optional().default('127.0.0.1'),
  REDIS_PORT: z
    .string()
    .default('6379')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z
    .string()
    .default('0')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
}).superRefine((config, ctx) => {
  if (config.COOKIE_SAME_SITE === 'none' && config.NODE_ENV !== 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['COOKIE_SAME_SITE'],
      message: 'none requires secure production cookies',
    });
  }
  if (config.NODE_ENV !== 'production') return;

  const requiredValues = [
    ['CLIENT_URL', process.env.CLIENT_URL],
    ['MONGODB_URI', config.MONGODB_URI],
    ['JWT_ACCESS_SECRET', config.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', config.JWT_REFRESH_SECRET],
    ['ENCRYPTION_KEY', config.ENCRYPTION_KEY],
  ];

  for (const [name, value] of requiredValues) {
    if (!value?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: 'is required in production',
      });
    }
  }

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = config[name];
    if (secret && secret.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: 'must contain at least 32 characters in production',
      });
    }
  }

  if (
    config.JWT_ACCESS_SECRET &&
    config.JWT_REFRESH_SECRET &&
    config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_REFRESH_SECRET'],
      message: 'must be different from JWT_ACCESS_SECRET',
    });
  }

  if (
    config.ENCRYPTION_KEY &&
    [config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET].includes(config.ENCRYPTION_KEY)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['ENCRYPTION_KEY'],
      message: 'must be independent from the JWT signing secrets',
    });
  }

  if (config.ENCRYPTION_KEY && !/^[a-fA-F0-9]{64}$/.test(config.ENCRYPTION_KEY)) {
    ctx.addIssue({
      code: 'custom',
      path: ['ENCRYPTION_KEY'],
      message: 'must be a 64-character hexadecimal key in production',
    });
  }

  if (!config.CLIENT_URL.startsWith('https://')) {
    ctx.addIssue({
      code: 'custom',
      path: ['CLIENT_URL'],
      message: 'must use HTTPS in production',
    });
  }

  if (config.API_BASE_URL && !config.API_BASE_URL.startsWith('https://')) {
    ctx.addIssue({
      code: 'custom',
      path: ['API_BASE_URL'],
      message: 'must use HTTPS in production',
    });
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(config.MONGODB_URI)) {
    ctx.addIssue({
      code: 'custom',
      path: ['MONGODB_URI'],
      message: 'must be a MongoDB connection URI in production',
    });
  }

  if (config.EMAIL_PROVIDER === 'console') {
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_PROVIDER'],
      message: 'console email previews are not allowed in production',
    });
  }

  if (
    config.EMAIL_PROVIDER === 'sendliberty' ||
    config.CAMPAIGN_EMAIL_PROVIDER === 'sendliberty'
  ) {
    if (!config.SENDLIBERTY_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['SENDLIBERTY_API_KEY'],
        message: 'is required when Sendliberty is selected',
      });
    }
    if (!config.SENDLIBERTY_FROM_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SENDLIBERTY_FROM_EMAIL'],
        message: 'is required when Sendliberty is selected',
      });
    }
  }

  for (const [provider, clientId, clientSecret, callbackUrl] of [
    ['Google', config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_CALLBACK_URL],
    [
      'Microsoft',
      config.MICROSOFT_CLIENT_ID,
      config.MICROSOFT_CLIENT_SECRET,
      config.MICROSOFT_CALLBACK_URL,
    ],
  ]) {
    if (Boolean(clientId) !== Boolean(clientSecret)) {
      ctx.addIssue({
        code: 'custom',
        path: [provider === 'Google' ? 'GOOGLE_CLIENT_SECRET' : 'MICROSOFT_CLIENT_SECRET'],
        message: `must be configured together with the ${provider} client ID`,
      });
    }
    if (clientId && !callbackUrl.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: [provider === 'Google' ? 'GOOGLE_CALLBACK_URL' : 'MICROSOFT_CALLBACK_URL'],
        message: `must use HTTPS when ${provider} OAuth is configured in production`,
      });
    }
  }

  if (config.QUEUE_FEATURES_ENABLED) {
    let redisUrl;
    try {
      redisUrl = new URL(process.env.REDIS_URL || '');
    } catch {
      redisUrl = null;
    }
    if (redisUrl?.protocol !== 'rediss:') {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'a rediss:// TCP connection URL is required when queue features are enabled',
      });
    }
  }

});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      'Invalid environment configuration:',
      result.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`)
    );
    process.exit(1);
  }
  const isProduction = result.data.NODE_ENV === 'production';
  return {
    ...result.data,
    CLIENT_URL: new URL(result.data.CLIENT_URL).origin,
    API_BASE_URL: result.data.API_BASE_URL
      ? new URL(result.data.API_BASE_URL).origin
      : '',
    JWT_ACCESS_SECRET:
      result.data.JWT_ACCESS_SECRET || crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET:
      result.data.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex'),
    ENCRYPTION_KEY:
      result.data.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    COOKIE_SAME_SITE: result.data.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
    EMAIL_PROVIDER:
      result.data.EMAIL_PROVIDER ||
      (isProduction
        ? 'disabled'
        : result.data.SMTP_USER && result.data.SMTP_PASS
          ? 'smtp'
          : 'console'),
  };
};

export const env = parseEnv();
