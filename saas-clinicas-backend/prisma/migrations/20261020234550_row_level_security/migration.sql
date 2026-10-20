-- Row-Level Security: segunda camada de isolamento entre clínicas.
--
-- As operações de uma clínica (prisma.forTenant / tenantTransaction) rodam
-- numa transação que faz:
--   SET LOCAL ROLE app_tenant;
--   SELECT set_config('app.tenant_id', '<id da clínica>', true);
-- e o próprio Postgres passa a recusar linhas de outras clínicas, mesmo que
-- uma consulta escape do filtro da aplicação. Sem app.tenant_id definido,
-- nenhuma linha passa (falha fechada).
--
-- O usuário dono das tabelas (o da DATABASE_URL) não é afetado pelas
-- políticas: ele segue atendendo login, refresh, rotas do master e o job de
-- LGPD, que por regra operam sem tenant.

-- Papel restrito, sem login. Criar papéis exige CREATEROLE: em bancos
-- gerenciados, crie-o antes manualmente (ver README).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
END
$$;

-- O usuário da aplicação precisa poder assumir o papel (SET ROLE)
GRANT app_tenant TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "clinics", "clinic_business_hours", "users", "refresh_tokens"
  TO app_tenant;
-- Log de auditoria: só leitura e inserção (reforça a imutabilidade)
GRANT SELECT, INSERT ON "audit_logs" TO app_tenant;

ALTER TABLE "clinics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinic_business_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- A clínica é o tenant: casa pelo próprio id
CREATE POLICY tenant_isolation ON "clinics"
  USING ("id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("id" = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "clinic_business_hours"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "users"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "refresh_tokens"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);
