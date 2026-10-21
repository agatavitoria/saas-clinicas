-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'UNDISCLOSED');

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "socialName" TEXT,
    "cpf" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" "Gender",
    "phone" TEXT,
    "email" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,
    "amendsId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_tenantId_name_idx" ON "patients"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenantId_cpf_key" ON "patients"("tenantId", "cpf");

-- CreateIndex
CREATE INDEX "patient_records_tenantId_patientId_occurredAt_idx" ON "patient_records"("tenantId", "patientId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "patient_records_amendsId_idx" ON "patient_records"("amendsId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_amendsId_fkey" FOREIGN KEY ("amendsId") REFERENCES "patient_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (ver migration row_level_security)
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "patients"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

CREATE POLICY tenant_isolation ON "patient_records"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

-- Paciente: inativado, nunca apagado pela aplicação
GRANT SELECT, INSERT, UPDATE ON "patients" TO app_tenant;
-- Prontuário imutável: só leitura e inserção (correções são adendos)
GRANT SELECT, INSERT ON "patient_records" TO app_tenant;
