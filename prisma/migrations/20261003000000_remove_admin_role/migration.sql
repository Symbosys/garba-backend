-- AlterEnum: Remove ADMIN from UserRole
CREATE TYPE "UserRole_new" AS ENUM ('PARTNER', 'ORGANIZER', 'SUPER_ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
