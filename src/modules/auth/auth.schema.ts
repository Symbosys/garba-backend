import { z } from "zod";

export const registrationSchema = z.object({
  role: z.enum(["PARTNER", "ORGANIZER"]),
  name: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(14, "Age must be at least 14").max(100, "Age must be at most 100"),
  email: z.email().max(254),
  phone: z.string().trim().min(5).max(25),
  password: z.string().min(4).max(72),
  addressLine: z.string().trim().min(3).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"]),
}).strict();

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
}).strict();

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  age: z.coerce.number().int().min(14, "Age must be at least 14").max(100, "Age must be at most 100").optional(),
  addressLine: z.string().trim().min(3).max(250).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
}).strict();

