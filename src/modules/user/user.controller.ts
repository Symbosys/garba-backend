import type { Request, Response } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { statusCode } from "../../types/types.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";
import { userQuerySchema } from "./user.schema.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const publicUserSelect = {
  id: true,
  name: true,
  age: true,
  gender: true,
  city: true,
  state: true,
  role: true,
  status: true,
  createdAt: true,
  photos: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, url: true, sortOrder: true },
  },
};

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = userQuerySchema.parse(req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const roleFilter = query.role || query.userType;
  const searchTerm = query.search || query.name;

  const where: Prisma.UserWhereInput = {
    status: "APPROVED",
    role: roleFilter && roleFilter !== "ALL"
      ? roleFilter
      : { in: ["PARTNER", "ORGANIZER"] },
    ...(searchTerm
      ? { name: { contains: searchTerm, mode: "insensitive" } }
      : {}),
    ...(query.state
      ? { state: { equals: query.state, mode: "insensitive" } }
      : {}),
    ...(query.city
      ? { city: { equals: query.city, mode: "insensitive" } }
      : {}),
    ...(query.gender && query.gender !== "ALL"
      ? { gender: query.gender }
      : {}),
    ...(query.minAge !== undefined || query.maxAge !== undefined
      ? {
          age: {
            ...(query.minAge !== undefined ? { gte: query.minAge } : {}),
            ...(query.maxAge !== undefined ? { lte: query.maxAge } : {}),
          },
        }
      : {}),
    ...(query.hasPhoto === true
      ? { photos: { some: {} } }
      : {}),
  };

  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: "desc" };
  switch (query.sortBy) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "name_asc":
      orderBy = { name: "asc" };
      break;
    case "name_desc":
      orderBy = { name: "desc" };
      break;
    case "age_asc":
      orderBy = { age: "asc" };
      break;
    case "age_desc":
      orderBy = { age: "desc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return SuccessResponse(res, "Users retrieved successfully", {
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
      search: searchTerm || null,
      state: query.state || null,
      city: query.city || null,
      role: roleFilter || "ALL",
      gender: query.gender || "ALL",
      minAge: query.minAge ?? null,
      maxAge: query.maxAge ?? null,
      sortBy: query.sortBy,
    },
  });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  if (!UUID_PATTERN.test(userId)) {
    throw new ErrorResponse("Invalid user identifier format", statusCode.Bad_Request);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      status: "APPROVED",
      role: { in: ["PARTNER", "ORGANIZER"] },
    },
    select: publicUserSelect,
  });

  // if (!user) {
  //   throw new ErrorResponse("User not found or profile not public", statusCode.Not_Found);
  // }

  return SuccessResponse(res, "User profile retrieved successfully", user);
});
