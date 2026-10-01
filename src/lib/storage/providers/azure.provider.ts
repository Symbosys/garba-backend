import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { ENV } from "../../../config/env.js";
import type {
  IStorageProvider,
  StorageFile,
  StorageProviderType,
  UploadOptions,
  UploadResult,
} from "../storage.interface.js";

/**
 * Production-grade Azure Blob Storage Provider implementing IStorageProvider.
 * Uses the official '@azure/storage-blob' package for Azure Blob storage.
 * Configured via AZURE_STORAGE_CONNECTION_STRING or (AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_STORAGE_CONTAINER).
 */
export class AzureBlobStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = "AZURE_BLOB";

  private readonly account: string;
  private readonly container: string;
  private readonly client: BlobServiceClient | null = null;

  constructor() {
    this.account = ENV.azure_storage_account || "";
    this.container = ENV.azure_storage_container || "assets";
    const key = ENV.azure_storage_key || "";
    const connectionString = ENV.azure_storage_connection_string;

    if (connectionString) {
      this.client = BlobServiceClient.fromConnectionString(connectionString);
    } else if (this.account && key) {
      const credential = new StorageSharedKeyCredential(this.account, key);
      this.client = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        credential
      );
    } else {
      console.warn(
        "[AzureBlobStorageProvider] Warning: Azure Storage credentials not fully configured in environment."
      );
    }
  }

  async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    if (!this.client) {
      throw new Error(
        "Azure Blob Storage credentials not configured. Please define AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY."
      );
    }

    const containerClient = this.client.getContainerClient(this.container);
    const blobName = `${options?.folder ? `${options.folder}/` : ""}${options?.publicId || `${Date.now()}-${file.originalname}`}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    const url = blockBlobClient.url;

    return {
      url,
      secureUrl: url,
      publicId: blobName,
      provider: "AZURE_BLOB",
      bytes: file.size,
      format: file.mimetype.split("/")[1] || "png",
    };
  }

  async delete(publicId: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const containerClient = this.client.getContainerClient(this.container);
      const blockBlobClient = containerClient.getBlockBlobClient(publicId);
      const response = await blockBlobClient.deleteIfExists();
      return Boolean(response.succeeded);
    } catch {
      return false;
    }
  }

  getUrl(publicId: string): string {
    if (this.client) {
      const containerClient = this.client.getContainerClient(this.container);
      return containerClient.getBlockBlobClient(publicId).url;
    }
    return `https://${this.account}.blob.core.windows.net/${this.container}/${publicId}`;
  }
}
