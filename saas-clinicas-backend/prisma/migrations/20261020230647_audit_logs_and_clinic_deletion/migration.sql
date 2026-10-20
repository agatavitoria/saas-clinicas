-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'PLATFORM_ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedById" UUID,
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" UUID,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" UUID,
    "targetLabel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_occurredAt_id_idx" ON "audit_logs"("tenantId", "occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "audit_logs_occurredAt_id_idx" ON "audit_logs"("occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- Imutabilidade do log de auditoria: só inserção. Anonimização (LGPD) e
-- limpeza de IP rodam numa transação com SET LOCAL app.audit_maintenance = 'on'.
CREATE OR REPLACE FUNCTION audit_logs_block_changes() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_changes();
