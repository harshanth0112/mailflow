import dotenv from 'dotenv';
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
    .default('http://localhost:5173'),
  API_BASE_URL: z
    .string()
    .default('http://localhost:5000'),
  MONGODB_URI: z
    .string()
    .optional()
    .default(''),
  JWT_ACCESS_SECRET: z
    .string()
    .default('mailflow-dev-access-secret-32-chars-long-key!'),
  JWT_REFRESH_SECRET: z
    .string()
    .default('mailflow-dev-refresh-secret-32-chars-long-key!'),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('7d'),
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
    .default('noreply@mailflow.io'),
  SMTP_FROM_NAME: z
    .string()
    .default('MailFlow Team'),
  // OAuth Providers (Optional in dev, but fully configured)
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().optional().default('http://localhost:5000/api/v1/auth/oauth/google/callback'),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CALLBACK_URL: z.string().optional().default('http://localhost:5000/api/v1/auth/oauth/github/callback'),
  MICROSOFT_CLIENT_ID: z.string().optional().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(''),
  MICROSOFT_CALLBACK_URL: z.string().optional().default('http://localhost:5000/api/v1/auth/oauth/microsoft/callback'),
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
    .transform((val) => parseInt(val, 10)),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
