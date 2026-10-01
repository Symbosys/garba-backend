import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { storageService } from "../../lib/storage/storage.service.js";
import { statusCode } from "../../types/types.js";
import { normalizePhone, parsePage } from "../../utils/normalization.util.js";
import { cleanupUploads, uploadImages } from "../../utils/upload.util.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";
import { eventQuerySchema, eventSchema, eventUpdateSchema, slotInputSchema, slotUpdateSchema } from "./event.schema.js";

const eventInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } },
  slots: { orderBy: [{ slotDate: "asc" as const }, { startTime: "asc" as const }] },
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

  const minFee = query.minFee ?? (query.minFeePaise !== undefined ? Math.round(query.minFeePaise / 100) : undefined);
  const maxFee = query.maxFee ?? (query.maxFeePaise !== undefined ? Math.round(query.maxFeePaise / 100) : undefined);

  const slotFilters: Record<string, unknown> = {};
  if (startsFromDate || startsBeforeDate) {
    slotFilters.startTime = {
      ...(startsFromDate ? { gte: startsFromDate } : {}),
      ...(startsBeforeDate ? { lte: startsBeforeDate } : {}),
    };
  }
  if (query.isFree === true) {
    slotFilters.entryFee = 0;
  } else if (minFee !== undefined || maxFee !== undefined) {
    slotFilters.entryFee = {
      ...(minFee !== undefined ? { gte: minFee } : {}),
      ...(maxFee !== undefined ? { lte: maxFee } : {}),
    };
  }

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
    ...(Object.keys(slotFilters).length > 0 ? { slots: { some: slotFilters } } : {}),
  };

  let orderBy: any = { createdAt: "desc" };
  switch (query.sortBy) {
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "title_asc":
      orderBy = { title: "asc" };
      break;
    case "upcoming":
    default:
      orderBy = { createdAt: "desc" };
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
      minFee: minFee ?? null,
      maxFee: maxFee ?? null,
      sortBy: query.sortBy,
    },
  });
});

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.params.eventIdOrSlug);
  const event = await prisma.event.findFirst({
    where: {
      OR: UUID_PATTERN.test(key) ? [{ id: key }, { slug: key }] : [{ slug: key }],
      status: "PUBLISHED",
      deletedAt: null,
      organizer: { status: "APPROVED" },
    },
    include: eventInclude,
  });
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
    const { slots, ...eventData } = input;
    const event = await prisma.event.create({
      data: {
        ...eventData,
        slug: slugify(input.title),
        organizerId: req.auth!.userId,
        images: {
          create: uploads.map((image, index) => ({
            url: image.secureUrl,
            publicId: image.publicId,
            provider: image.provider,
            mimeType: images[index]!.mimetype,
            bytes: image.bytes,
            sortOrder: index,
          })),
        },
        slots: {
          create: slots.map((slot) => ({
            title: slot.title,
            slotDate: slot.slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            entryFee: slot.entryFee,
            currency: slot.currency,
            capacity: slot.capacity,
          })),
        },
      },
      include: eventInclude,
    });
    return SuccessResponse(res, "Event created", event, statusCode.Created);
  } catch (error) {
    await cleanupUploads(uploads);
    throw error;
  }
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = eventUpdateSchema.parse(req.body);
  if (input.contactPhone) input.contactPhone = normalizePhone(input.contactPhone);
  const eventId = String(req.params.eventId);
  const current = await prisma.event.findFirst({ where: { id: eventId, organizerId: req.auth!.userId, deletedAt: null } });
  if (!current) throw new ErrorResponse("Event not found", statusCode.Not_Found);

  const { slots, ...eventData } = input;

  const updated = await prisma.$transaction(async (tx) => {
    if (slots !== undefined) {
      const existingSlots = await tx.eventSlot.findMany({
        where: { eventId },
        select: { id: true },
      });
      const existingIds = new Set(existingSlots.map((s) => s.id));
      const providedIds = new Set(slots.filter((s) => s.id && existingIds.has(s.id)).map((s) => s.id!));

      // Delete omitted slots
      const toDelete = existingSlots.filter((s) => !providedIds.has(s.id)).map((s) => s.id);
      if (toDelete.length > 0) {
        await tx.eventSlot.deleteMany({ where: { id: { in: toDelete } } });
      }

      // Update existing & insert new slots
      for (const slot of slots) {
        if (slot.id && existingIds.has(slot.id)) {
          await tx.eventSlot.update({
            where: { id: slot.id },
            data: {
              title: slot.title,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
              endTime: slot.endTime,
              entryFee: slot.entryFee,
              currency: slot.currency,
              capacity: slot.capacity,
            },
          });
        } else {
          await tx.eventSlot.create({
            data: {
              eventId,
              title: slot.title,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
              endTime: slot.endTime,
              entryFee: slot.entryFee,
              currency: slot.currency,
              capacity: slot.capacity,
            },
          });
        }
      }
    }

    return tx.event.update({
      where: { id: eventId, organizerId: req.auth!.userId },
      data: eventData,
      include: eventInclude,
    });
  });

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

export const addEventSlot = asyncHandler(async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const event = await prisma.event.findFirst({ where: { id: eventId, organizerId: req.auth!.userId, deletedAt: null }, select: { id: true } });
  if (!event) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  const input = slotInputSchema.parse(req.body);
  const slot = await prisma.eventSlot.create({
    data: {
      eventId,
      title: input.title,
      slotDate: input.slotDate,
      startTime: input.startTime,
      endTime: input.endTime,
      entryFee: input.entryFee,
      currency: input.currency,
      capacity: input.capacity,
    },
  });
  return SuccessResponse(res, "Event slot added", slot, statusCode.Created);
});

export const updateEventSlot = asyncHandler(async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const slotId = String(req.params.slotId);
  const slot = await prisma.eventSlot.findFirst({
    where: { id: slotId, eventId, event: { organizerId: req.auth!.userId, deletedAt: null } },
  });
  if (!slot) throw new ErrorResponse("Event slot not found", statusCode.Not_Found);
  const input = slotUpdateSchema.parse(req.body);
  const startTime = input.startTime ?? slot.startTime;
  const endTime = input.endTime ?? slot.endTime;
  if (endTime <= startTime) throw new ErrorResponse("endTime must be after startTime", statusCode.Bad_Request);

  const updated = await prisma.eventSlot.update({
    where: { id: slotId },
    data: input,
  });
  return SuccessResponse(res, "Event slot updated", updated);
});

export const deleteEventSlot = asyncHandler(async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const slotId = String(req.params.slotId);
  const slot = await prisma.eventSlot.findFirst({
    where: { id: slotId, eventId, event: { organizerId: req.auth!.userId, deletedAt: null } },
    select: { id: true },
  });
  if (!slot) throw new ErrorResponse("Event slot not found", statusCode.Not_Found);
  const totalSlots = await prisma.eventSlot.count({ where: { eventId } });
  if (totalSlots <= 1) throw new ErrorResponse("An event must have at least one slot", statusCode.Bad_Request);

  await prisma.eventSlot.delete({ where: { id: slotId } });
  return res.status(statusCode.No_Content).send();
});

