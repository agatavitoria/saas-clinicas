import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import {
  rlsStatements,
  tenantExtension,
  tenantTransactionContext,
} from './tenant-extension.js';

export type TenantClient = ReturnType<PrismaService['forTenant']>;

/** Client recebido dentro de uma tenantTransaction. */
export type TenantTransactionClient = Parameters<
  Parameters<TenantClient['$transaction']>[0]
>[0];

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  /**
   * Client restrito a um tenant: toda leitura e escrita fica limitada aos
   * dados da clínica informada. Use em tudo que vem de um usuário autenticado.
   */
  forTenant(tenantId: string) {
    return this.$extends(tenantExtension(tenantId, this));
  }

  /**
   * Transação interativa de uma clínica, com o RLS ativo do início ao fim.
   * Dentro do callback, use só o `tx` recebido.
   */
  tenantTransaction<T>(
    tenantId: string,
    fn: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    const db = this.forTenant(tenantId);
    return tenantTransactionContext.run(tenantId, () =>
      db.$transaction(async (tx) => {
        for (const statement of rlsStatements(tx, tenantId)) await statement;
        return fn(tx);
      }),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
