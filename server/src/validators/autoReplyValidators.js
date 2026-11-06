import { z } from 'zod';
import { MATCH_TYPES } from '../models/AutoReplyRule.js';

export const autoReplyRuleCreateSchema = z.object({
  emailAccountId: z.string({ error: (issue) => issue.input === undefined ? 'emailAccountId is required' : undefined }),
  name: z
    .string({ error: (issue) => issue.input === undefined ? 'Rule name is required' : undefined })
    .trim()
    .min(1, 'Name cannot be empty')
    .max(120, 'Name cannot exceed 120 characters'),
  priority: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
  conditions: z.object({
    keywords: z.array(z.string()).max(50, 'Cannot specify more than 50 keywords').optional().default([]),
    matchType: z.enum(MATCH_TYPES).optional().default(MATCH_TYPES.CONTAINS),
    checkSubject: z.boolean().optional().default(true),
    checkBody: z.boolean().optional().default(true),
    senderWhitelist: z.array(z.string()).max(200, 'Whitelist cannot exceed 200 entries').optional().default([]),
    senderBlacklist: z.array(z.string()).max(200, 'Blacklist cannot exceed 200 entries').optional().default([]),
  }).optional().prefault({}),
  replyTemplate: z.object({
    subject: z.string().optional().default('Re: {{subject}}'),
    body: z.string({ error: (issue) => issue.input === undefined ? 'Reply body is required' : undefined }).min(1, 'Reply body cannot be empty'),
    htmlBody: z.string().optional().default(''),
  }),
});

export const autoReplyRuleUpdateSchema = autoReplyRuleCreateSchema.partial();

export const autoReplySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(1).max(10080).optional(),
  defaultReplySubject: z.string().optional(),
  defaultReplyBody: z.string().optional(),
  ignoreNoReply: z.boolean().optional(),
  ignoreOwnMessages: z.boolean().optional(),
  pollIntervalSeconds: z.number().int().min(10).max(3600).optional(),
});
