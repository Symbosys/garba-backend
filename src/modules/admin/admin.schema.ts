import { z } from "zod";

export const reviewRegistrationSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }).strict(),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(500) }).strict(),
]);

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
};

export const registrationListQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(["PARTNER", "ORGANIZER"]).default("PARTNER"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
}).strict();

export const eventListQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
}).strict();
