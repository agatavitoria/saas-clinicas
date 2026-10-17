/** Banco usado pelos testes e2e (criado por docker/postgres/init.sql). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://saas_clinicas:saas_clinicas@localhost:5432/saas_clinicas_test';
