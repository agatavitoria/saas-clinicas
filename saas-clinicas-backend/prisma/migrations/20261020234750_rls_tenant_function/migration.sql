-- Clínica atual do RLS. Numa conexão do pool que já passou por outra
-- transação, a variável volta como '' (e não NULL); ''::uuid daria erro.
-- Tratando vazio como NULL, a política simplesmente não casa nenhuma linha.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

GRANT EXECUTE ON FUNCTION app_current_tenant() TO app_tenant;

ALTER POLICY tenant_isolation ON "clinics"
  USING ("id" = app_current_tenant())
  WITH CHECK ("id" = app_current_tenant());

ALTER POLICY tenant_isolation ON "clinic_business_hours"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

ALTER POLICY tenant_isolation ON "users"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

ALTER POLICY tenant_isolation ON "refresh_tokens"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

ALTER POLICY tenant_isolation ON "audit_logs"
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());
