import { Prisma } from '../generated/prisma/client.js';

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
 * informado. Escritas aninhadas (ex.: `users: { create }`) não passam pela
 * extensão: o Prisma já preenche a FK a partir do registro pai.
 */
export function tenantExtension(tenantId: string) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
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

          return query(scoped);
        },
      },
    },
  });
}

function forbiddenClinicCreate(): Error {
  return new Error('Clinics cannot be created through a tenant-scoped client');
}
