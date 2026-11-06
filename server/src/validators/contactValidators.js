import { z } from 'zod';
import { CONSENT_STATUS, CONTACT_STATUS, CONTACT_SOURCES } from '../models/Contact.js';

export const contactCreateSchema = z.object({
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required' : undefined })
    .email('Please provide a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .transform((val) => val.trim().toLowerCase()),
  firstName: z.string().max(100, 'First name cannot exceed 100 characters').optional().default(''),
  lastName: z.string().max(100, 'Last name cannot exceed 100 characters').optional().default(''),
  phone: z.string().max(50, 'Phone cannot exceed 50 characters').optional().default(''),
  company: z.string().max(150, 'Company cannot exceed 150 characters').optional().default(''),
  jobTitle: z.string().max(150, 'Job title cannot exceed 150 characters').optional().default(''),
  tags: z.array(z.string().trim().max(50)).max(100, 'Cannot specify more than 100 tags').optional().default([]),
  groups: z.array(z.string()).max(50, 'Cannot specify more than 50 groups').optional().default([]),
  customFields: z.record(z.string(), z.any()).optional().default({}),
  source: z.enum(CONTACT_SOURCES).optional().default(CONTACT_SOURCES.MANUAL),
  consentStatus: z.enum(CONSENT_STATUS).optional().default(CONSENT_STATUS.PENDING),
  status: z.enum(CONTACT_STATUS).optional().default(CONTACT_STATUS.SUBSCRIBED),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export const contactQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional().default(''),
  status: z.enum(CONTACT_STATUS).optional(),
  consentStatus: z.enum(CONSENT_STATUS).optional(),
  tag: z.string().optional(),
  groupId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'email', 'firstName', 'lastName', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const contactGroupSchema = z.object({
  name: z
    .string({ error: (issue) => issue.input === undefined ? 'Group name is required' : undefined })
    .trim()
    .min(1, 'Group name cannot be empty')
    .max(100, 'Group name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().default(''),
});

export const assignGroupsSchema = z.object({
  groupIds: z.array(z.string()).min(1, 'At least one group ID must be provided').max(200, 'Cannot specify more than 200 group IDs at once'),
  contactIds: z.array(z.string()).min(1, 'At least one contact ID must be provided').max(1000, 'Cannot specify more than 1000 contact IDs at once'),
  action: z.enum(['add', 'remove']).default('add'),
});

export const manageTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1)).min(1, 'At least one tag must be provided').max(50, 'Cannot specify more than 50 tags at once'),
  contactIds: z.array(z.string()).min(1, 'At least one contact ID must be provided').max(1000, 'Cannot specify more than 1000 contact IDs at once'),
  action: z.enum(['add', 'remove']).default('add'),
});
