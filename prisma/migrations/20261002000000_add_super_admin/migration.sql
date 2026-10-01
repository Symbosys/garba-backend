ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- The product owner account is intentionally unique and can only be provisioned operationally.
CREATE UNIQUE INDEX "users_single_super_admin_idx"
ON "users" (("role"))
WHERE "role" = 'SUPER_ADMIN';
