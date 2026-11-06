import { z } from 'zod';
import { CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from '../models/Campaign.js';

export const recipientConfigSchema = z.object({
  type: z.nativeEnum(RECIPIENT_SELECTION_TYPE).default(RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE),
  groupIds: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  contactIds: z.array(z.string()).optional().default([]),
});

export const campaignCreateSchema = z.object({
  name: z
    .string({ required_error: 'Campaign name is required' })
    .trim()
    .min(1, 'Campaign name cannot be empty')
    .max(200, 'Campaign name cannot exceed 200 characters'),
  subject: z
    .string({ required_error: 'Subject line is required' })
    .trim()
    .min(1, 'Subject line cannot be empty')
    .max(300, 'Subject line cannot exceed 300 characters'),
  previewText: z.string().max(250, 'Preview text cannot exceed 250 characters').optional().default(''),
  senderEmailAccountId: z.string().optional().nullable(),
  senderName: z.string().max(100, 'Sender name cannot exceed 100 characters').optional().default(''),
  replyTo: z.string().email('Valid reply-to email required').optional().or(z.literal('')).default(''),
  htmlContent: z.string().optional().default(''),
  textContent: z.string().optional().default(''),
  templateId: z.string().optional().nullable(),
  recipientConfiguration: recipientConfigSchema.optional().default({}),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().optional().default('UTC'),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

export const campaignQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional().default(''),
  status: z.nativeEnum(CAMPAIGN_STATUS).optional(),
  sortBy: z.enum(['createdAt', 'name', 'status', 'scheduledAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const campaignTestEmailSchema = z.object({
  recipientEmail: z
    .string({ required_error: 'Recipient email is required' })
    .email('Valid recipient email address is required')
    .transform((val) => val.trim().toLowerCase()),
});

