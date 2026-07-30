import { z } from "zod";

export const settingsSchema = z
  .object({
    name: z.string().min(1, "Restaurant Name is required").max(255),
    address: z.string().max(1000).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    email: z
      .string()
      .email("Invalid email address")
      .or(z.literal(""))
      .optional()
      .nullable(),
    gst_number: z.string().max(50).optional().nullable(),
    is_closed: z.boolean().optional(),
    tax_percentage: z
      .number({ message: "Tax percentage must be a number" })
      .min(0, "Tax percentage cannot be negative")
      .max(100, "Tax percentage cannot exceed 100"),
    service_charge_percentage: z
      .number({ message: "Service charge must be a number" })
      .min(0, "Service charge cannot be negative")
      .max(100, "Service charge cannot exceed 100"),
    opening_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format")
      .or(z.literal(""))
      .optional()
      .nullable(),
    closing_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format")
      .or(z.literal(""))
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.opening_time && data.closing_time) {
        return data.opening_time < data.closing_time;
      }
      return true;
    },
    {
      message: "Opening time must be earlier than closing time",
      path: ["closing_time"],
    }
  );

export type SettingsFormValues = z.infer<typeof settingsSchema>;
