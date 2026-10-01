import { z } from "zod";

const booleanParam = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val.toLowerCase() === "true" || val === "1") return true;
    if (val.toLowerCase() === "false" || val === "0") return false;
  }
  return undefined;
}, z.boolean().optional());

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  userType: z.enum(["PARTNER", "ORGANIZER", "ALL"]).optional(),
  role: z.enum(["PARTNER", "ORGANIZER", "ALL"]).optional(),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY", "ALL"]).optional(),
  minAge: z.coerce.number().int().min(14).max(100).optional(),
  maxAge: z.coerce.number().int().min(14).max(100).optional(),
  hasPhoto: booleanParam,
  sortBy: z.enum(["newest", "oldest", "name_asc", "name_desc", "age_asc", "age_desc"]).default("newest"),
}).strict();

export type UserQueryInput = z.infer<typeof userQuerySchema>;
