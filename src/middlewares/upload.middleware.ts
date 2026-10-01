import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../utils/response.util.js";
import { statusCode } from "../types/types.js";

export type UploadCategory = "image" | "document" | "media" | "all";

export interface UploadOptions {
  category?: UploadCategory;
  allowedMimeTypes?: string[];
  maxFileSize?: number; // In bytes (default: 5MB)
}

const MIME_PRESETS: Record<Exclude<UploadCategory, "all">, string[]> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  media: [
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
  ],
};

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const memoryStorage = multer.memoryStorage();

/**
 * Parses stringified JSON fields commonly sent inside multipart/form-data.
 */
function parseMultipartBody(req: Request) {
  if (!req.body || typeof req.body !== "object") return;
  for (const key of Object.keys(req.body)) {
    const val = req.body[key];
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          req.body[key] = JSON.parse(trimmed);
        } catch {
          // Keep raw string for validator reporting
        }
      }
    }
  }
}

/**
 * Builds a configured multer instance with memory storage, category presets, and size limits.
 */
function createMulter(options?: UploadOptions) {
  const category = options?.category ?? "image";
  const allowedMimes =
    options?.allowedMimeTypes ??
    (category === "all" ? [] : MIME_PRESETS[category] || []);
  const maxSize = options?.maxFileSize ?? DEFAULT_MAX_SIZE;

  return multer({
    storage: memoryStorage,
    limits: { fileSize: maxSize, files: 10, fields: 30, parts: 40, fieldSize: 100 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowedMimes.length === 0 || allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new ErrorResponse(
            `Unsupported file format: ${file.mimetype}. Allowed formats: ${allowedMimes.join(", ")}`,
            statusCode.Bad_Request
          ) as any
        );
      }
    },
  });
}

/**
 * Wraps multer execution with centralized error handling and automatic multipart JSON parsing.
 */
function wrapMiddleware(
  uploader: (req: Request, res: Response, next: (err?: any) => void) => void,
  maxSize: number = DEFAULT_MAX_SIZE
) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploader(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            const mb = Math.round(maxSize / (1024 * 1024));
            return next(
              new ErrorResponse(
                `File size limit exceeded. Maximum allowed: ${mb}MB`,
                statusCode.Bad_Request
              )
            );
          }
          return next(new ErrorResponse(err.message, statusCode.Bad_Request));
        }
        return next(err);
      }

      parseMultipartBody(req);
      next();
    });
  };
}

/**
 * Universal, production-grade upload middleware.
 *
 * Supports single file, array of files, multiple fields, or any file upload dynamically.
 *
 * Examples:
 *   upload.single("logo")
 *   upload.single("avatar")
 *   upload.single("document", { category: "document", maxFileSize: 10 * 1024 * 1024 })
 *   upload.array("images", 5)
 *   upload.fields([{ name: "logo", maxCount: 1 }, { name: "banner", maxCount: 1 }])
 */
export const upload = {
  /**
   * Single file upload middleware.
   * @param fieldName The multipart form field name (e.g., 'logo', 'avatar', 'file')
   */
  single(fieldName: string = "file", options?: UploadOptions) {
    const uploader = createMulter(options).single(fieldName);
    return wrapMiddleware(uploader, options?.maxFileSize);
  },

  /**
   * Multiple files upload middleware under the same field name.
   */
  array(fieldName: string = "files", maxCount: number = 10, options?: UploadOptions) {
    const uploader = createMulter(options).array(fieldName, maxCount);
    return wrapMiddleware(uploader, options?.maxFileSize);
  },

  /**
   * Multiple fields upload middleware with distinct field names.
   */
  fields(fields: multer.Field[], options?: UploadOptions) {
    const uploader = createMulter(options).fields(fields);
    return wrapMiddleware(uploader, options?.maxFileSize);
  },

  /**
   * Accepts any files sent over multipart.
   */
  any(options?: UploadOptions) {
    const uploader = createMulter(options).any();
    return wrapMiddleware(uploader, options?.maxFileSize);
  },

  /**
   * Accepts only multipart fields without any files.
   */
  none() {
    return wrapMiddleware(multer().none());
  },
};

// Also export class/alias for backwards-compatibility
export const UploadMiddleware = upload;
export default upload;
