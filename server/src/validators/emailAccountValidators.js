import { z } from 'zod';

export const initiateOAuthSchema = z.object({
  provider: z.enum(['gmail', 'outlook']).default('gmail'),
  redirectUri: z.string().url().optional(),
});

export const oauthCallbackSchema = z.object({
  code: z.string({ error: (issue) => issue.input === undefined ? 'Authorization code is required' : undefined }),
  state: z.string({ error: (issue) => issue.input === undefined ? 'OAuth state is required' : undefined }),
  redirectUri: z.string().url().optional(),
});

export const testEmailSchema = z.object({
  recipientEmail: z
    .string({ error: (issue) => issue.input === undefined ? 'Recipient email is required' : undefined })
    .email('Valid recipient email address is required')
    .transform((val) => val.trim().toLowerCase()),
});
