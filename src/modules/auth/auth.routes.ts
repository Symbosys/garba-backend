import { Router } from "express";
import { UPLOAD_LIMITS } from "../../config/constants.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { login, me, register, registrationConfig, updateProfile } from "./auth.controller.js";

export const authRouter = Router();
const imageOptions = {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSize: UPLOAD_LIMITS.imageBytes,
};

authRouter.get("/public/registration-config", registrationConfig);
authRouter.post(
  "/auth/register",
  upload.fields(
    [
      { name: "profilePhotos", maxCount: UPLOAD_LIMITS.profilePhotos },
      { name: "paymentScreenshot", maxCount: 1 },
    ],
    imageOptions,
  ),
  register,
);
authRouter.post("/auth/login", login);
authRouter.get("/auth/me", authenticate, me);
authRouter.patch(
  "/auth/me",
  authenticate,
  upload.fields(
    [{ name: "profilePhotos", maxCount: UPLOAD_LIMITS.profilePhotos }],
    imageOptions,
  ),
  updateProfile,
);

