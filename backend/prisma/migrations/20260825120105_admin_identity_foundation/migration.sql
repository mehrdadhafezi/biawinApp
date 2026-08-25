-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_EDITOR', 'SUPPORT_VIEWER');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'CONTENT_EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_refresh_tokens" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" "AdminAuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_refresh_tokens_tokenHash_key" ON "admin_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_refresh_tokens_adminUserId_idx" ON "admin_refresh_tokens"("adminUserId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminUserId_createdAt_idx" ON "admin_audit_logs"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_resourceType_resourceId_idx" ON "admin_audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "admin_refresh_tokens_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
