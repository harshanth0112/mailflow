import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ error: (issue) => issue.input === undefined ? 'Name is required' : undefined })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required' : undefined })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string({ error: (issue) => issue.input === undefined ? 'Password is required' : undefined })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, 'You must accept the terms of service and privacy policy'),
});

export const loginSchema = z.object({
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required' : undefined })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string({ error: (issue) => issue.input === undefined ? 'Password is required' : undefined })
    .min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z
    .string({ error: (issue) => issue.input === undefined ? 'Verification token is required' : undefined })
    .min(10, 'Invalid token length'),
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .optional(),
});

export const resendVerificationSchema = z.object({
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required' : undefined })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required' : undefined })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: (issue) => issue.input === undefined ? 'Reset token is required' : undefined })
    .min(10, 'Invalid reset token'),
  password: z
    .string({ error: (issue) => issue.input === undefined ? 'Password is required' : undefined })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: (issue) => issue.input === undefined ? 'Current password is required' : undefined })
    .min(1, 'Current password is required'),
  newPassword: z
    .string({ error: (issue) => issue.input === undefined ? 'New password is required' : undefined })
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  onboardingStep: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional(),
  onboardingCompleted: z
    .boolean()
    .optional(),
  onboardingSkipped: z
    .boolean()
    .optional(),
});
