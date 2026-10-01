import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { statusCode } from "../../types/types.js";
import { parsePage } from "../../utils/normalization.util.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";

const partnerSelect = { id: true, name: true, age: true, city: true, state: true, gender: true, createdAt: true, photos: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } } };

export const listPartners = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePage(req.query.page, req.query.limit);
  const where = {
    role: "PARTNER" as const, status: "APPROVED" as const,
    ...(typeof req.query.city === "string" ? { city: { equals: req.query.city, mode: "insensitive" as const } } : {}),
    ...(typeof req.query.state === "string" ? { state: { equals: req.query.state, mode: "insensitive" as const } } : {}),
    ...(typeof req.query.gender === "string" && ["MALE", "FEMALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"].includes(req.query.gender) ? { gender: req.query.gender as any } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: partnerSelect, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);
  return SuccessResponse(res, "Partners", { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getPartner = asyncHandler(async (req: Request, res: Response) => {
  const partner = await prisma.user.findFirst({ where: { id: String(req.params.partnerId), role: "PARTNER", status: "APPROVED" }, select: partnerSelect });
  if (!partner) throw new ErrorResponse("Partner not found", statusCode.Not_Found);
  return SuccessResponse(res, "Partner", partner);
});
