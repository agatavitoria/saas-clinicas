-- CreateTable
CREATE TABLE "clinic_brandings" (
    "tenantId" UUID NOT NULL,
    "primaryColor" TEXT,
    "logo" BYTEA,
    "logoMimeType" TEXT,
    "logoUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_brandings_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "clinic_brandings" ADD CONSTRAINT "clinic_brandings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (ver migration row_level_security)
ALTER TABLE "clinic_brandings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "clinic_brandings"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

-- Remover o logo ou a cor é um UPDATE para null; a linha só sai com a clínica
GRANT SELECT, INSERT, UPDATE ON "clinic_brandings" TO app_tenant;
