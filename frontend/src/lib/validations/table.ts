import { z } from "zod";

export const TABLE_STATUSES = [
  "available",
  "reserved",
  "awaiting_verification",
  "occupied",
  "billing",
  "cleaning",
  "out_of_service",
] as const;

export const tableCreateSchema = z.object({
  table_number: z
    .string()
    .min(1, "Table number is required")
    .max(50, "Table number cannot exceed 50 characters"),
  capacity: z
    .number({ message: "Capacity must be a number" })
    .min(1, "Capacity must be at least 1 seat")
    .max(100, "Capacity cannot exceed 100 seats"),
  status: z.enum(TABLE_STATUSES),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
});

export const tableUpdateSchema = z.object({
  table_number: z
    .string()
    .min(1, "Table number is required")
    .max(50, "Table number cannot exceed 50 characters"),
  capacity: z
    .number({ message: "Capacity must be a number" })
    .min(1, "Capacity must be at least 1 seat")
    .max(100, "Capacity cannot exceed 100 seats"),
  status: z.enum(TABLE_STATUSES),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
});

export type TableCreateFormValues = z.infer<typeof tableCreateSchema>;
export type TableUpdateFormValues = z.infer<typeof tableUpdateSchema>;
