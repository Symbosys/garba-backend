import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { ENV } from "../../../config/env.js";
import type {
  IStorageProvider,
  StorageFile,
  StorageProviderType,
  UploadOptions,
  UploadResult,
} from "../storage.interface.js";

/**
 * Production-grade Cloudinary Storage Provider implementing IStorageProvider.
 * Uses the official 'cloudinary' NPM SDK for seamless, resilient asset lifecycle management.
 */
export class CloudinaryStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = "CLOUDINARY";

  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly defaultFolder: string;

  constructor() {
    this.cloudName = ENV.CLOUD_NAME || "";
    this.apiKey = ENV.CLOUD_API_KEY || "";
    this.apiSecret = ENV.CLOUD_API_SECRET || "";
    this.defaultFolder = ENV.CLOUD_FOLDER || "garba";

    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    } else {
      console.warn(
        "[CloudinaryStorageProvider] Warning: Cloudinary credentials not fully configured in environment."
      );
    }
  }

  async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error(
        "Cloudinary credentials missing: CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET must be set."
      );
    }

    const folder = options?.folder || this.defaultFolder;

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: "image",
      format: "jpg",
    };

    if (options?.publicId !== undefined) {
      uploadOptions.public_id = options.publicId;
    }
    if (options?.overwrite !== undefined) {
      uploadOptions.overwrite = options.overwrite;
    }
    if (options?.tags !== undefined) {
      uploadOptions.tags = options.tags;
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, uploadResult) => {
          if (error || !uploadResult) {
            console.error("[Cloudinary Upload Error]", error);
            return reject(error || new Error("Cloudinary upload failed: No result returned"));
          }
          resolve(uploadResult);
        }
      );

      uploadStream.end(file.buffer);
    });

    const uploadResult: UploadResult = {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      provider: "CLOUDINARY",
      bytes: result.bytes || file.size,
      format: result.format || file.mimetype.split("/")[1] || "png",
    };

    if (result.width !== undefined) {
      uploadResult.width = result.width;
    }
    if (result.height !== undefined) {
      uploadResult.height = result.height;
    }

    return uploadResult;
  }

  async delete(publicId: string): Promise<boolean> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      return false;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === "ok";
    } catch {
      return false;
    }
  }

  getUrl(publicId: string): string {
    return cloudinary.url(publicId, { secure: true });
  }
}
