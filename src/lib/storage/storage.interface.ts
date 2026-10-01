/**
 * Supported storage provider types.
 */
export type StorageProviderType = "CLOUDINARY" | "AWS_S3" | "AZURE_BLOB" | "LOCAL";

/**
 * Encapsulated file structure for storage uploads.
 */
export interface StorageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Options passed to storage providers for upload operations.
 */
export interface UploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
  resourceType?: "image" | "video" | "raw" | "auto";
  overwrite?: boolean;
}

/**
 * Standardized upload response returned across all storage providers.
 */
export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  provider: StorageProviderType;
  bytes: number;
  format: string;
  width?: number;
  height?: number;
}

/**
 * Universal Storage Provider contract.
 * Any cloud provider (Cloudinary, AWS S3, Azure Blob, Google Cloud Storage)
 * must implement this contract.
 */
export interface IStorageProvider {
  readonly providerType: StorageProviderType;

  /**
   * Upload a file buffer to the underlying cloud storage.
   */
  upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Delete an asset from cloud storage by its public ID / key.
   */
  delete(publicId: string): Promise<boolean>;

  /**
   * Resolve an asset's public URL from its identifier.
   */
  getUrl(publicId: string): string;
}
