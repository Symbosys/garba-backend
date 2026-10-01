import dotenv from "dotenv";

dotenv.config();

const STORAGE_PROVIDERS = ["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"] as const;
export type ConfiguredStorageProvider = (typeof STORAGE_PROVIDERS)[number];

const rawStorageProvider = (process.env.STORAGE_PROVIDER || "CLOUDINARY").trim().toUpperCase();
if (!STORAGE_PROVIDERS.includes(rawStorageProvider as ConfiguredStorageProvider)) {
  throw new Error(`Invalid STORAGE_PROVIDER "${rawStorageProvider}". Expected one of: ${STORAGE_PROVIDERS.join(", ")}`);
}

export const ENV = {
  PORT: Number(process.env.PORT || 4000),
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,

  // Active Storage Provider: "CLOUDINARY" | "AWS_S3" | "AZURE_BLOB" | "LOCAL"
  STORAGE_PROVIDER: rawStorageProvider as ConfiguredStorageProvider,

  CLOUD_NAME: process.env.CLOUD_NAME,
  CLOUD_API_KEY: process.env.CLOUD_API_KEY,
  CLOUD_API_SECRET: process.env.CLOUD_API_SECRET,
  CLOUD_FOLDER: process.env.CLOUD_FOLDER,

  // AWS S3 Credentials
  aws_s3_bucket: process.env.AWS_S3_BUCKET,
  aws_region: process.env.AWS_REGION,
  aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
  aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,

  // Azure Blob Storage Credentials
  azure_storage_account: process.env.AZURE_STORAGE_ACCOUNT,
  azure_storage_key: process.env.AZURE_STORAGE_KEY,
  azure_storage_container: process.env.AZURE_STORAGE_CONTAINER || "assets",
  azure_storage_connection_string: process.env.AZURE_STORAGE_CONNECTION_STRING,

  MODE: process.env.MODE as "DEVELOPMENT" | "PRODUCTION",
  OLA_MAPS_API_KEY: process.env.OLA_MAPS_API_KEY,
};
