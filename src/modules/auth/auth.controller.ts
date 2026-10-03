import type { Request, Response } from "express";
import { REGISTRATION_CURRENCY, REGISTRATION_FEE_PAISE } from "../../config/constants.js";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { statusCode } from "../../types/types.js";
import { generateToken } from "../../utils/jwt.util.js";
import { normalizeEmail, normalizePhone } from "../../utils/normalization.util.js";
import { hashPassword, verifyPassword } from "../../utils/password.util.js";
import { ErrorResponse, SuccessResponse } from "../../utils/response.util.js";
import { cleanupUploads, uploadImages } from "../../utils/upload.util.js";
import { loginSchema, registrationSchema, updateProfileSchema } from "./auth.schema.js";

const safeUserSelect = { id: true, name: true, age: true, email: true, phone: true, addressLine: true, city: true, state: true, gender: true, role: true, status: true, createdAt: true, photos: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, sortOrder: true } } };

export const registrationConfig = (_req: Request, res: Response) => SuccessResponse(res, "Registration configuration", {
  feePaise: REGISTRATION_FEE_PAISE,
  feeRupees: REGISTRATION_FEE_PAISE / 100,
  currency: REGISTRATION_CURRENCY,
  roles: ["PARTNER", "ORGANIZER"],
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registrationSchema.parse(req.body);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const profilePhotos = files.profilePhotos ?? [];
  const paymentScreenshots = files.paymentScreenshot ?? [];
  if (profilePhotos.length < 1) throw new ErrorResponse("At least one profile photo is required", statusCode.Bad_Request);
  if (paymentScreenshots.length !== 1) throw new ErrorResponse("Exactly one payment screenshot is required", statusCode.Bad_Request);

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } });
  if (existing) throw new ErrorResponse("An account with this email or phone already exists", statusCode.Conflict);

  const uploaded: Array<Awaited<ReturnType<typeof uploadImages>>[number]> = [];
  try {
    const proofUploads = await uploadImages(paymentScreenshots, "registration-payment-proofs");
    uploaded.push(...proofUploads);
    const photoUploads = await uploadImages(profilePhotos, "profile-photos");
    uploaded.push(...photoUploads);
    const proof = proofUploads[0]!;
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        role: input.role, name: input.name, age: input.age, email, phone, passwordHash,
        addressLine: input.addressLine, city: input.city, state: input.state, gender: input.gender,
        photos: { create: photoUploads.map((photo, index) => ({ url: photo.secureUrl, publicId: photo.publicId, provider: photo.provider, mimeType: profilePhotos[index]!.mimetype, bytes: photo.bytes, sortOrder: index })) },
        registrationPayment: { create: { amountPaise: REGISTRATION_FEE_PAISE, currency: REGISTRATION_CURRENCY, proofUrl: proof.secureUrl, proofPublicId: proof.publicId, proofProvider: proof.provider, proofMimeType: paymentScreenshots[0]!.mimetype, proofBytes: proof.bytes } },
      },
      select: { id: true, role: true, status: true, createdAt: true },
    });
    return SuccessResponse(res, "Registration submitted for payment verification", user, statusCode.Created);
  } catch (error) {
    await cleanupUploads(uploaded);
    throw error;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new ErrorResponse("Invalid email or password", statusCode.Unauthorized);
  if (user.status !== "APPROVED") throw new ErrorResponse(`Account is ${user.status.toLowerCase()}; login is available after admin approval`, statusCode.Forbidden);
  const token = generateToken(user.id, user.tokenVersion);
  return SuccessResponse(res, "Login successful", { token, user: { id: user.id, name: user.name, role: user.role, status: user.status }, redirectTo: user.role === "SUPER_ADMIN" ? "/admin" : user.role === "ORGANIZER" ? "/organizer" : "/dashboard" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: safeUserSelect });
  if (!user) throw new ErrorResponse("User not found", statusCode.Not_Found);
  return SuccessResponse(res, "Current user", user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const profilePhotos = files.profilePhotos ?? [];

  const updateData = {
    ...(input.name ? { name: input.name } : {}),
    ...(input.age !== undefined ? { age: input.age } : {}),
    ...(input.addressLine ? { addressLine: input.addressLine } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.state ? { state: input.state } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
  };

  const uploaded: Array<Awaited<ReturnType<typeof uploadImages>>[number]> = [];
  try {
    if (profilePhotos.length > 0) {
      const photoUploads = await uploadImages(profilePhotos, "profile-photos");
      uploaded.push(...photoUploads);

      await prisma.userPhoto.deleteMany({ where: { userId: req.auth!.userId } });
      await prisma.userPhoto.createMany({
        data: photoUploads.map((photo, index) => ({
          userId: req.auth!.userId,
          url: photo.secureUrl,
          publicId: photo.publicId,
          provider: photo.provider,
          mimeType: profilePhotos[index]!.mimetype,
          bytes: photo.bytes,
          sortOrder: index,
        })),
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: updateData,
      select: safeUserSelect,
    });

    return SuccessResponse(res, "Profile updated successfully", updatedUser);
  } catch (error) {
    if (uploaded.length > 0) await cleanupUploads(uploaded);
    throw error;
  }
});

