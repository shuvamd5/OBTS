import { z } from 'zod';

export const passwordRule = z
  .string()
  .min(8, 'Password must be between 8 and 25 characters')
  .max(25, 'Password must be between 8 and 25 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\$\*\.,+\-=@]/, 'Password must contain at least one symbol ($ * . , + - = @)');

export const registerSchema = z.object({
  uname: z
    .string()
    .min(1)
    .max(25)
    .regex(/^[a-zA-Z-' ]*$/, 'Name may only contain letters, spaces, apostrophes and hyphens'),
  uemail: z.string().email('A valid email is required'),
  umobile: z.string().regex(/^\d{10}$/, 'Mobile must be exactly 10 digits'),
  upass: passwordRule,
  ugender: z.enum(['Female', 'Male', 'Other']),
});

export const loginSchema = z.object({
  logid: z.string().min(1, 'Email/Mobile is required'),
  logpass: z.string().min(1, 'Password is required'),
});