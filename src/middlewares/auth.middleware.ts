import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { statusCode } from "../types/types.js";
import { verifyToken } from "../utils/jwt.util.js";
import { asyncHandler } from "./error.middleware.js";
import { ErrorResponse } from "../utils/response.util.js";

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new ErrorResponse("Authentication required", statusCode.Unauthorized);
  let payload;
  try { payload = verifyToken(header.slice(7)); }
  catch { throw new ErrorResponse("Invalid or expired access token", statusCode.Unauthorized); }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true, tokenVersion: true } });
  if (!user || user.status !== "APPROVED" || user.tokenVersion !== payload.tokenVersion) throw new ErrorResponse("Session is no longer valid", statusCode.Unauthorized);
  req.auth = { userId: user.id, role: user.role };
  next();
});

export const authorize = (...roles: UserRole[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || !roles.includes(req.auth.role)) return next(new ErrorResponse("You do not have permission for this action", statusCode.Forbidden));
  next();
};
