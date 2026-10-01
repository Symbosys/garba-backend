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

async function normalizeImage(file: Express.Multer.File): Promise<StorageFile> {
  try {
    const pipeline = sharp(file.buffer, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true });

    const buffer = file.mimetype === "image/png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : file.mimetype === "image/webp"
        ? await pipeline.webp({ quality: 92 }).toBuffer()
        : await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

    return {
      buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: buffer.length,
    };
  } catch {
    throw new ErrorResponse(
      "One of the uploaded images is damaged or cannot be processed. Please upload a valid JPEG, PNG, or WebP image",
      statusCode.Bad_Request,
    );
  }
}

export async function uploadImages(files: Express.Multer.File[], folder: string) {
  files.forEach(assertSafeImage);
  const completed = [];
  try {
    for (const file of files) {
      const normalized = await normalizeImage(file);
      completed.push(await storageService.upload(normalized, { folder, publicId: crypto.randomUUID(), resourceType: "image" }));
    }
    return completed;
  } catch (error) {
    await cleanupUploads(completed);
    if (error && typeof error === "object" && "http_code" in error && error.http_code === 400) {
      throw new ErrorResponse(
        "Cloud storage rejected an uploaded image. Please retry with a valid JPEG, PNG, or WebP image",
        statusCode.Bad_Request,
      );
    }
    throw error;
  }
}

export async function cleanupUploads(uploads: Array<{ publicId: string }>) {
  await Promise.allSettled(uploads.map((upload) => storageService.delete(upload.publicId)));
}
