import type { Request, Response } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { statusCode } from "../../types/types.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";
import { eventListQuerySchema, registrationListQuerySchema, reviewRegistrationSchema } from "./admin.schema.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requireUuid = (value: unknown, label = "identifier") => {
  const id = String(value);
  if (!UUID_PATTERN.test(id)) throw new ErrorResponse(`Invalid ${label}`, statusCode.Bad_Request);
  return id;
};

const listUserSelect = {
  id: true, name: true, age: true, email: true, phone: true, city: true, state: true, gender: true,
  role: true, status: true, rejectionReason: true, approvedAt: true, createdAt: true,
  photos: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } },
  registrationPayment: { select: { amountPaise: true, currency: true, status: true, createdAt: true, reviewedAt: true, rejectionReason: true } },
};

const detailUserSelect = {
  ...listUserSelect,
  addressLine: true,
  registrationPayment: { select: { amountPaise: true, currency: true, status: true, proofUrl: true, proofMimeType: true, proofBytes: true, createdAt: true, reviewedAt: true, rejectionReason: true, reviewedBy: { select: { id: true, name: true } } } },
};

const adminEventInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } },
  slots: { orderBy: [{ slotDate: "asc" as const }, { startTime: "asc" as const }] },
  organizer: { select: { id: true, name: true, email: true, phone: true, city: true, state: true, status: true } },
};

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const publicRoles = ["PARTNER", "ORGANIZER"] as const;
  const [
    totalUsers, verifiedUsers, unverifiedUsers, rejectedUsers, partnerUsers, organizerUsers,
    totalPayments, verifiedPayments, unverifiedPayments, rejectedPayments, revenue,
    totalEvents, publishedEvents, draftEvents, cancelledEvents, recentPending,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { role: { in: [...publicRoles] } } }),
    prisma.user.count({ where: { role: { in: [...publicRoles] }, status: "APPROVED" } }),
    prisma.user.count({ where: { role: { in: [...publicRoles] }, status: "PENDING" } }),
    prisma.user.count({ where: { role: { in: [...publicRoles] }, status: "REJECTED" } }),
    prisma.user.count({ where: { role: "PARTNER" } }),
    prisma.user.count({ where: { role: "ORGANIZER" } }),
    prisma.registrationPayment.count(),
    prisma.registrationPayment.count({ where: { status: "APPROVED" } }),
    prisma.registrationPayment.count({ where: { status: "PENDING" } }),
    prisma.registrationPayment.count({ where: { status: "REJECTED" } }),
    prisma.registrationPayment.aggregate({ where: { status: "APPROVED" }, _sum: { amountPaise: true } }),
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.event.count({ where: { deletedAt: null, status: "DRAFT" } }),
    prisma.event.count({ where: { deletedAt: null, status: "CANCELLED" } }),
    prisma.user.findMany({ where: { role: { in: [...publicRoles] }, status: "PENDING" }, take: 6, orderBy: { createdAt: "asc" }, select: listUserSelect }),
  ]);
  return SuccessResponse(res, "Super admin dashboard", {
    users: { total: totalUsers, verified: verifiedUsers, unverified: unverifiedUsers, rejected: rejectedUsers, partners: partnerUsers, organizers: organizerUsers },
    payments: { total: totalPayments, verified: verifiedPayments, unverified: unverifiedPayments, rejected: rejectedPayments, verifiedRevenuePaise: revenue._sum.amountPaise ?? 0 },
    events: { total: totalEvents, published: publishedEvents, draft: draftEvents, cancelled: cancelledEvents },
    recentPending,
  });
});

export const listRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const input = registrationListQuerySchema.parse(req.query);
  const skip = (input.page - 1) * input.limit;
  const where: Prisma.UserWhereInput = {
    role: input.role,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { OR: [
      { name: { contains: input.search, mode: "insensitive" } },
      { email: { contains: input.search, mode: "insensitive" } },
      { phone: { contains: input.search } },
      { city: { contains: input.search, mode: "insensitive" } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, skip, take: input.limit, orderBy: { createdAt: "desc" }, select: listUserSelect }),
    prisma.user.count({ where }),
  ]);
  return SuccessResponse(res, "Registrations", { items, pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) } });
});

export const getRegistration = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findFirst({ where: { id: requireUuid(req.params.userId, "user identifier"), role: { in: ["PARTNER", "ORGANIZER"] } }, select: detailUserSelect });
  if (!user) throw new ErrorResponse("Registration not found", statusCode.Not_Found);
  return SuccessResponse(res, "Registration", user);
});

export const reviewRegistration = asyncHandler(async (req: Request, res: Response) => {
  const input = reviewRegistrationSchema.parse(req.body);
  const userId = requireUuid(req.params.userId, "user identifier");
  const approved = input.decision === "APPROVE";
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.registrationPayment.updateMany({
      where: { userId, status: "PENDING", user: { status: "PENDING", role: { in: ["PARTNER", "ORGANIZER"] } } },
      data: { status: approved ? "APPROVED" : "REJECTED", reviewedAt: now, reviewedById: req.auth!.userId, rejectionReason: approved ? null : input.reason },
    });
    if (claimed.count !== 1) throw new ErrorResponse("Registration is missing or has already been reviewed", statusCode.Conflict);
    return tx.user.update({
      where: { id: userId },
      data: { status: approved ? "APPROVED" : "REJECTED", approvedAt: approved ? now : null, approvedById: approved ? req.auth!.userId : null, rejectionReason: approved ? null : input.reason },
      select: { id: true, role: true, status: true, approvedAt: true, rejectionReason: true },
    });
  });
  return SuccessResponse(res, approved ? "Registration approved" : "Registration rejected", result);
});

export const listAllEvents = asyncHandler(async (req: Request, res: Response) => {
  const input = eventListQuerySchema.parse(req.query);
  const where: Prisma.EventWhereInput = {
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { OR: [
      { title: { contains: input.search, mode: "insensitive" } },
      { venueName: { contains: input.search, mode: "insensitive" } },
      { city: { contains: input.search, mode: "insensitive" } },
      { organizer: { name: { contains: input.search, mode: "insensitive" } } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({ where, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: { createdAt: "desc" }, include: adminEventInclude }),
    prisma.event.count({ where }),
  ]);
  return SuccessResponse(res, "Events", { items, pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) } });
});

export const getAdminEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findFirst({ where: { id: requireUuid(req.params.eventId, "event identifier"), deletedAt: null }, include: adminEventInclude });
  if (!event) throw new ErrorResponse("Event not found", statusCode.Not_Found);
  return SuccessResponse(res, "Event", event);
});
