-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "outsideBusinessHours" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "cancelReason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_tenantId_startsAt_idx" ON "appointments"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "appointments_tenantId_professionalId_startsAt_idx" ON "appointments"("tenantId", "professionalId", "startsAt");

-- CreateIndex
CREATE INDEX "appointments_patientId_startsAt_idx" ON "appointments"("patientId", "startsAt");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Horário coerente
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_range_check"
  CHECK ("endsAt" > "startsAt");

-- O mesmo profissional não tem dois agendamentos ativos sobrepostos. A trava
-- fica no banco para valer também com duas marcações simultâneas. Cancelados
-- e faltas liberam o horário. O intervalo é [início, fim): um termina às
-- 09:00 e o seguinte começa às 09:00 sem conflito.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "professionalId" WITH =,
    tsrange("startsAt", "endsAt") WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED'));

-- Row-Level Security (ver migration row_level_security)
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "appointments"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

-- Agendamento: cancelado, nunca apagado pela aplicação
GRANT SELECT, INSERT, UPDATE ON "appointments" TO app_tenant;
