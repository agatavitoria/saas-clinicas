import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

/**
 * Tenant da transação interativa em andamento (ver tenantTransaction). Dentro
 * dela, o papel e o tenant do RLS já foram definidos no início, então as
 * operações rodam direto, na própria transação.
 */
export const tenantTransactionContext = new AsyncLocalStorage<string>();

/**
 * Prepara a transação atual para o Row-Level Security: assume o papel
 * restrito e informa a clínica. Ambos valem só até o fim da transação.
 */
export function rlsStatements(
  db: Pick<PrismaClient, '$executeRaw'>,
  tenantId: string,
) {
  return [
    db.$executeRaw`SET LOCAL ROLE app_tenant`,
    db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
  ] as const;
}

/**
 * Campo que liga cada modelo ao tenant. A própria clínica é o tenant,
 * então ela é filtrada pelo `id`.
 */
const TENANT_FIELD: Partial<Record<Prisma.ModelName, string>> = {
  Clinic: 'id',
  ClinicBusinessHour: 'tenantId',
  User: 'tenantId',
  RefreshToken: 'tenantId',
  AuditLog: 'tenantId',
};

const WHERE_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/** Operações sobre registro único: o filtro extra entra no `where` único. */
const UNIQUE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
]);

const CREATE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);

/**
 * Restringe todas as consultas e escritas de nível superior ao tenant
 * informado, em duas camadas:
 * 1. filtro da aplicação: `where`/`data` recebem o tenant;
 * 2. Row-Level Security: cada operação roda numa transação curta com o papel
 *    `app_tenant` e `app.tenant_id` definidos, e o Postgres recusa linhas de
 *    outras clínicas mesmo que o filtro falhe.
 *
 * Escritas aninhadas (ex.: `users: { create }`) não passam pela extensão: o
 * Prisma já preenche a FK a partir do registro pai (e o RLS confere).
 */
export function tenantExtension(tenantId: string, base: PrismaClient) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const field = TENANT_FIELD[model];
          if (!field) return query(args);

          const scoped = { ...(args as Record<string, any>) };

          if (WHERE_OPERATIONS.has(operation)) {
            scoped.where = { AND: [scoped.where ?? {}, { [field]: tenantId }] };
          } else if (UNIQUE_OPERATIONS.has(operation)) {
            scoped.where = { ...scoped.where, [field]: tenantId };
          } else if (operation === 'upsert') {
            if (model === 'Clinic') throw forbiddenClinicCreate();
            scoped.where = { ...scoped.where, [field]: tenantId };
            scoped.create = { ...scoped.create, [field]: tenantId };
          } else if (CREATE_OPERATIONS.has(operation)) {
            if (model === 'Clinic') throw forbiddenClinicCreate();
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((item: object) => ({
                  ...item,
                  [field]: tenantId,
                }))
              : { ...scoped.data, [field]: tenantId };
          }

          // Já dentro de uma tenantTransaction desta clínica
          if (tenantTransactionContext.getStore() === tenantId) {
            return query(scoped);
          }

          const [, , result] = await base.$transaction([
            ...rlsStatements(base, tenantId),
            query(scoped),
          ]);
          return result;
        },
      },
    },
  });
}

function forbiddenClinicCreate(): Error {
  return new Error('Clinics cannot be created through a tenant-scoped client');
}
