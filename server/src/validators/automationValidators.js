import { z } from 'zod';
import {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_STATUS,
} from '../models/AutomationRule.js';

export const automationCreateSchema = z.object({
  name: z
    .string({ required_error: 'Automation name is required' })
    .trim()
    .min(1, 'Automation name cannot be empty')
    .max(150, 'Automation name cannot exceed 150 characters'),
  description: z.string().trim().max(500).optional().default(''),
  status: z.nativeEnum(AUTOMATION_STATUS).optional().default(AUTOMATION_STATUS.ACTIVE),
  trigger: z.object({
    type: z.nativeEnum(AUTOMATION_TRIGGER_TYPES),
    configuration: z
      .object({
        tag: z.string().optional().default(''),
        groupId: z.string().optional().nullable(),
      })
      .optional()
      .default({}),
  }),
  action: z.object({
    type: z.nativeEnum(AUTOMATION_ACTION_TYPES),
    configuration: z
      .object({
        campaignId: z.string().optional().nullable(),
        tag: z.string().optional().default(''),
        groupId: z.string().optional().nullable(),
        delayMinutes: z.number().int().min(0).max(10080).optional().default(0), // max 7 days delay
      })
      .optional()
      .default({}),
  }),
});

export const automationUpdateSchema = automationCreateSchema.partial();

export const automationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional().default(''),
  status: z.nativeEnum(AUTOMATION_STATUS).optional(),
});
