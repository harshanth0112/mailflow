import { z } from 'zod';

export const emailTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(120),
  description: z.string().max(500).optional().default(''),
  subject: z.string().max(300).optional().default(''),
  htmlContent: z.string().max(200000, 'HTML content is too large').optional().default(''),
  textContent: z.string().max(100000, 'Text content is too large').optional().default(''),
});

export const emailTemplateQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.string().optional().transform((value) => (value ? Math.max(1, parseInt(value, 10)) : 1)),
  limit: z.string().optional().transform((value) => (value ? Math.min(100, Math.max(1, parseInt(value, 10))) : 100)),
});
