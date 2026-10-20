import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuditAction } from './audit-actions.js';
import {
  type AuditActor,
  type AuditClsStore,
  SYSTEM_ACTOR,
} from './audit-context.js';

export interface AuditTarget {
  type: string;
  id: string;
  label?: string;
}

export interface AuditLogOptions {
  target?: AuditTarget;
  /** Só ids, papéis, booleanos e campos alterados; nunca dados pessoais. */
  metadata?: Prisma.InputJsonObject;
  /** Sobrescreve o ator do contexto (ex.: no login, antes da sessão existir). */
  actor?: AuditActor;
  /** Sobrescreve o tenant do ator (ex.: o master agindo sobre uma clínica). */
  tenantId?: string | null;
}

/** Qualquer client que grave audit_logs: o prisma, um forTenant ou uma transação. */
export interface AuditWriter {
  auditLog: {
    create(args: {
      data: Prisma.AuditLogUncheckedCreateInput;
    }): Promise<unknown>;
  };
}

/**
 * Registra eventos de auditoria. Quem chama passa o client da transação em
 * andamento, para que a ação e o registro sejam gravados juntos (ou nenhum).
 * Ator, IP e user agent vêm do contexto da requisição.
 */
@Injectable()
export class AuditService {
  constructor(private readonly cls: ClsService<AuditClsStore>) {}

  async log(
    db: AuditWriter,
    action: AuditAction,
    options: AuditLogOptions = {},
  ): Promise<void> {
    const actor = options.actor ?? this.currentActor();
    const tenantId =
      options.tenantId !== undefined ? options.tenantId : actor.tenantId;

    await db.auditLog.create({
      data: {
        tenantId,
        actorType: actor.type,
        actorId: actor.id,
        actorLabel: actor.label,
        action,
        targetType: options.target?.type ?? null,
        targetId: options.target?.id ?? null,
        targetLabel: options.target?.label ?? null,
        metadata: options.metadata ?? {},
        ip: this.get('ip') ?? null,
        userAgent: this.get('userAgent') ?? null,
      },
    });
  }

  currentActor(): AuditActor {
    return this.get('actor') ?? SYSTEM_ACTOR;
  }

  /** Fora de uma requisição (ex.: job agendado) não há contexto ativo. */
  private get<K extends keyof AuditClsStore>(
    key: K,
  ): AuditClsStore[K] | undefined {
    return this.cls.isActive() ? this.cls.get(key) : undefined;
  }
}
