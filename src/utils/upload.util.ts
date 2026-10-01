import crypto from "node:crypto";
import sharp from "sharp";
import type { StorageFile } from "../lib/storage/storage.interface.js";
import { storageService } from "../lib/storage/storage.service.js";
import { statusCode } from "../types/types.js";
import { ErrorResponse } from "./response.util.js";

const isJpeg = (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const isWebp = (b: Buffer) => b.length >= 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP";

export function assertSafeImage(file: Express.Multer.File) {
  const valid = (file.mimetype === "image/jpeg" && isJpeg(file.buffer)) || (file.mimetype === "image/png" && isPng(file.buffer)) || (file.mimetype === "image/webp" && isWebp(file.buffer));
  if (!valid) throw new ErrorResponse("Uploaded file content is not a valid JPEG, PNG, or WebP image", statusCode.Bad_Request);
}

const TARGET_MAX_BYTES = 100 * 1024; // 100 KB max limit

async function compressUnder100KB(buffer: Buffer): Promise<{ buffer: Buffer; mimetype: string }> {
  // Pass 1: Try high quality with 1280px max dimension
  let maxDim = 1280;
  let quality = 80;

  let outBuffer = await sharp(buffer, { failOn: "none", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, progressive: true, mozjpeg: false })
    .toBuffer();

  // If already under 100 KB, return immediately
  if (outBuffer.length <= TARGET_MAX_BYTES) {
    return { buffer: outBuffer, mimetype: "image/jpeg" };
  }

  // Pass 2: Step-down quality and dimensions progressively until <= 100 KB
  const steps = [
    { dim: 1024, q: 72 },
    { dim: 900, q: 65 },
    { dim: 800, q: 55 },
    { dim: 640, q: 48 },
    { dim: 500, q: 40 },
  ];

  for (const step of steps) {
    outBuffer = await sharp(buffer, { failOn: "none", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: step.dim, height: step.dim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: step.q, progressive: true, mozjpeg: false })
      .toBuffer();

    if (outBuffer.length <= TARGET_MAX_BYTES) {
      break;
    }
  }

  return { buffer: outBuffer, mimetype: "image/jpeg" };
}

async function normalizeImage(file: Express.Multer.File): Promise<StorageFile> {
  try {
    const { buffer: compressedBuffer, mimetype } = await compressUnder100KB(file.buffer);

    return {
      buffer: compressedBuffer,
      originalname: file.originalname.replace(/\.[^/.]+$/, ".jpg"),
      mimetype: mimetype,
      size: compressedBuffer.length,
    };
  } catch (err) {
    console.error("[Image Processing Error]", err);
    throw new ErrorResponse(
      "One of the uploaded images is damaged or cannot be processed. Please upload a valid JPEG, PNG, or WebP image",
      statusCode.Bad_Request,
    );
  }
}

export async function uploadImages(files: Express.Multer.File[], folder: string) {
  files.forEach(assertSafeImage);
  const completed: Array<{ publicId: string }> = [];
  try {
    // Process and compress all images to <= 100KB in parallel
    const normalizedFiles = await Promise.all(files.map((file) => normalizeImage(file)));

    // Upload all normalized assets to cloud storage in parallel
    const uploadResults = await Promise.all(
      normalizedFiles.map(async (normalized) => {
        const res = await storageService.upload(normalized, {
          folder,
          publicId: crypto.randomUUID(),
          resourceType: "image",
        });
        completed.push(res);
        return res;
      })
    );

    return uploadResults;
  } catch (error: any) {
    await cleanupUploads(completed);
    console.error("[UploadImages Cloud Storage Error]", error);

    const errorMessage =
      error?.message ||
      (error && typeof error === "object" && "http_code" in error
        ? "Cloud storage rejected an uploaded image. Please check credentials or retry with a valid image"
        : "Failed to upload image to cloud storage");

    throw new ErrorResponse(errorMessage, statusCode.Bad_Request);
  }
}

export async function cleanupUploads(uploads: Array<{ publicId: string }>) {
  await Promise.allSettled(uploads.map((upload) => storageService.delete(upload.publicId)));
}

