import { ENV } from "../../config/env.js";
import { AzureBlobStorageProvider } from "./providers/azure.provider.js";
import { CloudinaryStorageProvider } from "./providers/cloudinary.provider.js";
import { AwsS3StorageProvider } from "./providers/s3.provider.js";
import type { IStorageProvider, StorageProviderType } from "./storage.interface.js";

/**
 * Storage Factory responsible for instantiating the appropriate storage provider
 * based on environment configuration (STORAGE_PROVIDER).
 *
 * Defaults to CLOUDINARY. To migrate to AWS or Azure, simply change the STORAGE_PROVIDER
 * env variable (e.g., STORAGE_PROVIDER=AWS_S3) without changing any application code.
 */
export class StorageFactory {
  private static instance: IStorageProvider;

  private static assertSelectedProviderIsConfigured(providerType: StorageProviderType) {
    const missing = (entries: Array<[string, string | undefined]>) =>
      entries.filter(([, value]) => !value).map(([name]) => name);

    if (providerType === "CLOUDINARY") {
      const names = missing([
        ["CLOUD_NAME", ENV.CLOUD_NAME],
        ["CLOUD_API_KEY", ENV.CLOUD_API_KEY],
        ["CLOUD_API_SECRET", ENV.CLOUD_API_SECRET],
      ]);
      if (names.length) throw new Error(`Cloudinary is selected but these credentials are missing: ${names.join(", ")}`);
      return;
    }

    if (providerType === "AWS_S3") {
      const names = missing([
        ["AWS_S3_BUCKET", ENV.aws_s3_bucket],
        ["AWS_REGION", ENV.aws_region],
        ["AWS_ACCESS_KEY_ID", ENV.aws_access_key_id],
        ["AWS_SECRET_ACCESS_KEY", ENV.aws_secret_access_key],
      ]);
      if (names.length) throw new Error(`AWS S3 is selected but these credentials are missing: ${names.join(", ")}`);
      return;
    }

    if (providerType === "AZURE_BLOB") {
      const hasConnectionString = Boolean(ENV.azure_storage_connection_string);
      const hasAccountCredentials = Boolean(ENV.azure_storage_account && ENV.azure_storage_key);
      if (!hasConnectionString && !hasAccountCredentials) {
        throw new Error("Azure Blob is selected but credentials are missing. Set AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY");
      }
      return;
    }

    throw new Error("LOCAL storage is not implemented. Select CLOUDINARY, AWS_S3, or AZURE_BLOB");
  }

  static getProvider(type?: StorageProviderType): IStorageProvider {
    if (this.instance && !type) {
      return this.instance;
    }

    const providerType: StorageProviderType = type || ENV.STORAGE_PROVIDER;
    this.assertSelectedProviderIsConfigured(providerType);

    let provider: IStorageProvider;

    switch (providerType) {
      case "AWS_S3":
        provider = new AwsS3StorageProvider();
        break;
      case "AZURE_BLOB":
        provider = new AzureBlobStorageProvider();
        break;
      case "CLOUDINARY":
        provider = new CloudinaryStorageProvider();
        break;
      default:
        throw new Error(`Unsupported storage provider: ${providerType}`);
    }

    if (!type) {
      this.instance = provider;
    }

    return provider;
  }
}
