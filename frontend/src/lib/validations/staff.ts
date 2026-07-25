import { z } from "zod";

export const staffCreateSchema = z.object({
  first_name: z
    .string()
    .min(1, "First Name is required")
    .max(100, "First Name cannot exceed 100 characters"),
  last_name: z
    .string()
    .min(1, "Last Name is required")
    .max(100, "Last Name cannot exceed 100 characters"),
  email: z
    .string()
    .min(1, "Email Address is required")
    .email("Invalid email address format"),
  phone: z
    .string()
    .max(50, "Phone number cannot exceed 50 characters")
    .optional()
    .nullable(),
  role_codes: z
    .array(z.string())
    .min(1, "At least one role must be assigned"),
  is_active: z.boolean(),
});

export const staffUpdateSchema = z.object({
  first_name: z
    .string()
    .min(1, "First Name is required")
    .max(100, "First Name cannot exceed 100 characters"),
  last_name: z
    .string()
    .min(1, "Last Name is required")
    .max(100, "Last Name cannot exceed 100 characters"),
  email: z
    .string()
    .min(1, "Email Address is required")
    .email("Invalid email address format"),
  phone: z
    .string()
    .max(50, "Phone number cannot exceed 50 characters")
    .optional()
    .nullable(),
  role_codes: z
    .array(z.string())
    .min(1, "At least one role must be assigned"),
  is_active: z.boolean(),
});

export type StaffCreateFormValues = z.infer<typeof staffCreateSchema>;
export type StaffUpdateFormValues = z.infer<typeof staffUpdateSchema>;
