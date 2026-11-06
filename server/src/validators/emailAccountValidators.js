import { z } from 'zod';

export const initiateOAuthSchema = z.object({
  provider: z.enum(['gmail', 'outlook']).default('gmail'),
  redirectUri: z.string().url().optional(),
});

export const oauthCallbackSchema = z.object({
  code: z.string({ required_error: 'Authorization code is required' }),
  state: z.string({ required_error: 'OAuth state is required' }),
  redirectUri: z.string().url().optional(),
});

export const testEmailSchema = z.object({
  recipientEmail: z
    .string({ required_error: 'Recipient email is required' })
    .email('Valid recipient email address is required')
    .transform((val) => val.trim().toLowerCase()),
});

