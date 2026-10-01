-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTNER', 'ORGANIZER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDINARY', 'AWS_S3', 'AZURE_BLOB', 'LOCAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address_line" VARCHAR(250) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "gender" "Gender" NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" VARCHAR(500),
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_id" UUID,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "proof_url" TEXT NOT NULL,
    "proof_public_id" TEXT NOT NULL,
    "proof_provider" "StorageProvider" NOT NULL,
    "proof_mime_type" VARCHAR(100) NOT NULL,
    "proof_bytes" INTEGER NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(190) NOT NULL,
    "description" TEXT NOT NULL,
    "venue_name" VARCHAR(160) NOT NULL,
    "address_line" VARCHAR(250) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "entry_fee_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "capacity" INTEGER,
    "contact_email" VARCHAR(254),
    "contact_phone" VARCHAR(20),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_images" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_city_state_role_status_idx" ON "users"("city", "state", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_photos_user_id_sort_order_key" ON "user_photos"("user_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "registration_payments_user_id_key" ON "registration_payments"("user_id");

-- CreateIndex
CREATE INDEX "registration_payments_status_created_at_idx" ON "registration_payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "events_city_state_status_starts_at_idx" ON "events"("city", "state", "status", "starts_at");

-- CreateIndex
CREATE INDEX "events_organizer_id_deleted_at_created_at_idx" ON "events"("organizer_id", "deleted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_images_event_id_sort_order_key" ON "event_images"("event_id", "sort_order");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain invariants enforced even when data is written outside the API.
ALTER TABLE "users" ADD CONSTRAINT "users_token_version_nonnegative" CHECK ("token_version" >= 0);
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_bytes_positive" CHECK ("bytes" > 0);
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_sort_order_nonnegative" CHECK ("sort_order" >= 0);
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_amount_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_proof_bytes_positive" CHECK ("proof_bytes" > 0);
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "events" ADD CONSTRAINT "events_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "events" ADD CONSTRAINT "events_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "events" ADD CONSTRAINT "events_date_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "events" ADD CONSTRAINT "events_entry_fee_nonnegative" CHECK ("entry_fee_paise" >= 0);
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_bytes_positive" CHECK ("bytes" > 0);
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_sort_order_nonnegative" CHECK ("sort_order" >= 0);
