import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { storageService } from "../../lib/storage/storage.service.js";
import { statusCode } from "../../types/types.js";
import { normalizePhone, parsePage } from "../../utils/normalization.util.js";
import { cleanupUploads, uploadImages } from "../../utils/upload.util.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";
import { eventQuerySchema, eventSchema, eventUpdateSchema } from "./event.schema.js";

const eventInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } },
  organizer: {
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      photos: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true }, take: 1 },
    },
  },
};

const slugify = (title: string) => `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 150)}-${crypto.randomBytes(4).toString("hex")}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const query = eventQuerySchema.parse(req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const startsFromDate = query.startsFrom && !Number.isNaN(Date.parse(query.startsFrom))
    ? new Date(query.startsFrom)
    : undefined;
  const startsBeforeDate = query.startsBefore && !Number.isNaN(Date.parse(query.startsBefore))
    ? new Date(query.startsBefore)
    : undefined;

  const where = {
    deletedAt: null,
    status: (query.status && query.status !== "ALL" ? query.status : "PUBLISHED") as any,
    organizer: { status: "APPROVED" as const, role: "ORGANIZER" as const },
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            { description: { contains: query.search, mode: "insensitive" as const } },
            { venueName: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" as const } } : {}),
    ...(query.state ? { state: { equals: query.state, mode: "insensitive" as const } } : {}),
    ...(startsFromDate || startsBeforeDate
      ? {
          startsAt: {
            ...(startsFromDate ? { gte: startsFromDate } : {}),
            ...(startsBeforeDate ? { lte: startsBeforeDate } : {}),
          },
        }
      : {}),
    ...(query.isFree === true
      ? { entryFeePaise: 0 }
      : query.minFeePaise !== undefined || query.maxFeePaise !== undefined
      ? {
          entryFeePaise: {
            ...(query.minFeePaise !== undefined ? { gte: query.minFeePaise } : {}),
            ...(query.maxFeePaise !== undefined ? { lte: query.maxFeePaise } : {}),
          },
        }
      : {}),
  };

  let orderBy: any = { startsAt: "asc" };
  switch (query.sortBy) {
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "fee_asc":
      orderBy = { entryFeePaise: "asc" };
      break;
    case "fee_desc":
      orderBy = { entryFeePaise: "desc" };
      break;
    case "title_asc":
      orderBy = { title: "asc" };
      break;
    case "upcoming":
    default:
      orderBy = { startsAt: "asc" };
      break;
  }

  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({ where, include: eventInclude, skip, take: limit, orderBy }),
    prisma.event.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return SuccessResponse(res, "Events retrieved successfully", {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    filters: {
      search: query.search || null,
      state: query.state || null,
      city: query.city || null,
      status: query.status || "PUBLISHED",
      isFree: query.isFree ?? null,
      minFeePaise: query.minFeePaise ?? null,
      maxFeePaise: query.maxFeePaise ?? null,
      sortBy: query.sortBy,
    },
  });
});

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.params.eventIdOrSlug);
  const event = await prisma.event.findFirst({ where: { OR: UUID_PATTERN.test(key) ? [{ id: key }, { slug: key }] : [{ slug: key }], status: "PUBLISHED", deletedAt: null, organizer: { status: "APPROVED" } }, include: eventInclude });
  if (!event) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  return SuccessResponse(res, "Event", event);
});

export const listOwnEvents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePage(req.query.page, req.query.limit);
  const where = { organizerId: req.auth!.userId, deletedAt: null };
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({ where, include: eventInclude, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.event.count({ where }),
  ]);
  return SuccessResponse(res, "Organizer events", { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getOwnEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findFirst({ where: { id: String(req.params.eventId), organizerId: req.auth!.userId, deletedAt: null }, include: eventInclude });
  if (!event) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  return SuccessResponse(res, "Organizer event", event);
});

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = eventSchema.parse(req.body);
  if (input.contactPhone) input.contactPhone = normalizePhone(input.contactPhone);
  const images = ((req.files ?? {}) as Record<string, Express.Multer.File[]>).images ?? [];
  if (images.length < 1) throw new ErrorResponse("At least one event image is required", statusCode.Bad_Request);
  const uploads = await uploadImages(images, "event-images");
  try {
    const event = await prisma.event.create({
      data: { ...input, slug: slugify(input.title), organizerId: req.auth!.userId, images: { create: uploads.map((image, index) => ({ url: image.secureUrl, publicId: image.publicId, provider: image.provider, mimeType: images[index]!.mimetype, bytes: image.bytes, sortOrder: index })) } },
      include: eventInclude,
    });
    return SuccessResponse(res, "Event created", event, statusCode.Created);
  } catch (error) { await cleanupUploads(uploads); throw error; }
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = eventUpdateSchema.parse(req.body);
  if (input.contactPhone) input.contactPhone = normalizePhone(input.contactPhone);
  const current = await prisma.event.findFirst({ where: { id: String(req.params.eventId), organizerId: req.auth!.userId, deletedAt: null }, select: { startsAt: true, endsAt: true } });
  if (!current) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt ?? current.endsAt;
  if (endsAt <= startsAt) throw new ErrorResponse("endsAt must be after startsAt", statusCode.Bad_Request);
  const updated = await prisma.event.update({ where: { id: String(req.params.eventId), organizerId: req.auth!.userId }, data: input, include: eventInclude });
  return SuccessResponse(res, "Event updated", updated);
});

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const result = await prisma.event.updateMany({ where: { id: String(req.params.eventId), organizerId: req.auth!.userId, deletedAt: null }, data: { deletedAt: new Date(), status: "CANCELLED" } });
  if (!result.count) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  return res.status(statusCode.No_Content).send();
});

export const addEventImages = asyncHandler(async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const event = await prisma.event.findFirst({ where: { id: eventId, organizerId: req.auth!.userId, deletedAt: null }, select: { id: true, _count: { select: { images: true } } } });
  if (!event) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  const images = ((req.files ?? {}) as Record<string, Express.Multer.File[]>).images ?? [];
  if (!images.length) throw new ErrorResponse("At least one image is required", statusCode.Bad_Request);
  if (event._count.images + images.length > 10) throw new ErrorResponse("An event can have at most 10 images", statusCode.Bad_Request);
  const uploads = await uploadImages(images, "event-images");
  try {
    await prisma.eventImage.createMany({ data: uploads.map((image, index) => ({ eventId, url: image.secureUrl, publicId: image.publicId, provider: image.provider, mimeType: images[index]!.mimetype, bytes: image.bytes, sortOrder: event._count.images + index })) });
    return SuccessResponse(res, "Event images added", { count: uploads.length }, statusCode.Created);
  } catch (error) { await cleanupUploads(uploads); throw error; }
});

export const deleteEventImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await prisma.eventImage.findFirst({ where: { id: String(req.params.imageId), eventId: String(req.params.eventId), event: { organizerId: req.auth!.userId, deletedAt: null } }, select: { id: true, publicId: true } });
  if (!image) throw new ErrorResponse("Event image not found", statusCode.Not_Found);
  await prisma.eventImage.delete({ where: { id: image.id } });
  await storageService.delete(image.publicId);
  return res.status(statusCode.No_Content).send();
});
