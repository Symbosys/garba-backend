import { StorageFactory } from "./storage.factory.js";
import type {
  IStorageProvider,
  StorageFile,
  UploadOptions,
  UploadResult,
} from "./storage.interface.js";

/**
 * High-level Storage Service facade used across all domain services and controllers.
 * Completely decouples business logic from any specific cloud storage vendor.
 */
export class StorageService {
  constructor(private readonly provider: IStorageProvider = StorageFactory.getProvider()) {}

  /**
   * Upload an asset to the active cloud storage provider.
   */
  async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    return this.provider.upload(file, options);
  }

  /**
   * Delete an asset from the active cloud storage provider.
   */
  async delete(publicId: string): Promise<boolean> {
    return this.provider.delete(publicId);
  }

  /**
   * Resolve public URL for an asset.
   */
  getUrl(publicId: string): string {
    return this.provider.getUrl(publicId);
  }

  /**
   * Get the name of the currently active storage provider.
   */
  get activeProviderName(): string {
    return this.provider.providerType;
  }
}

export const storageService = new StorageService();
