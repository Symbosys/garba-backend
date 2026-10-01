import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

const eventFields = {
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10_000),
  venueName: z.string().trim().min(2).max(160),
  addressLine: z.string().trim().min(3).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: optionalText(20),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  entryFeePaise: z.coerce.number().int().min(0).max(100_000_000),
  capacity: z.preprocess((v) => v === "" || v === undefined ? undefined : Number(v), z.number().int().positive().max(10_000_000).optional()),
  contactEmail: z.preprocess((v) => v === "" || v === undefined ? undefined : v, z.email().max(254).optional()),
  contactPhone: optionalText(20),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]),
};

export const eventSchema = z.object({ ...eventFields, status: eventFields.status.default("DRAFT") }).strict()
  .refine((value) => value.endsAt > value.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });

export const eventUpdateSchema = z.object(eventFields).partial().strict();

const booleanParam = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val.toLowerCase() === "true" || val === "1") return true;
    if (val.toLowerCase() === "false" || val === "0") return false;
  }
  return undefined;
}, z.boolean().optional());

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  status: z.enum(["PUBLISHED", "DRAFT", "CANCELLED", "ALL"]).optional(),
  startsFrom: z.string().trim().optional(),
  startsBefore: z.string().trim().optional(),
  minFeePaise: z.coerce.number().int().min(0).optional(),
  maxFeePaise: z.coerce.number().int().min(0).optional(),
  isFree: booleanParam,
  sortBy: z.enum(["upcoming", "newest", "fee_asc", "fee_desc", "title_asc"]).default("upcoming"),
}).strict();

export type EventQueryInput = z.infer<typeof eventQuerySchema>;

