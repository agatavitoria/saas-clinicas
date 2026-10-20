import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SYSTEM_ACTOR } from '../audit/audit-context.js';
import { AuditService } from '../audit/audit.service.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const ANONYMIZED_USER = 'Usuário removido';
export const ANONYMIZED_TARGET = 'Removido';
export const ANONYMIZED_CLINIC = 'Clínica removida';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * Rotinas de LGPD que rodam sozinhas, uma vez por dia:
 * - exclusão definitiva das clínicas cuja carência terminou;
 * - limpeza de IP e user agent de logs antigos (minimização).
 *
 * Os logs de auditoria só aceitam UPDATE/DELETE em "modo de manutenção"
 * (ver a trigger na migration), ligado apenas dentro destas transações.
 */
@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDaily(): Promise<void> {
    await this.purgeDueClinics();
    await this.expireAuditIps();
  }

  /** Exclui as clínicas com exclusão vencida; devolve os ids excluídos. */
  async purgeDueClinics(now = new Date()): Promise<string[]> {
    const due = await this.prisma.clinic.findMany({
      where: { deletionScheduledFor: { lte: now } },
      select: { id: true, deletionScheduledFor: true },
    });

    const purged: string[] = [];
    for (const clinic of due) {
      try {
        await this.prisma.$transaction((tx) =>
          this.purgeClinic(tx, clinic.id, clinic.deletionScheduledFor!),
        );
        purged.push(clinic.id);
      } catch (error) {
        // Uma falha não impede as demais; tenta de novo no próximo dia
        this.logger.error(`Failed to purge clinic ${clinic.id}`, error);
      }
    }
    return purged;
  }

  /** Apaga IP e user agent dos logs mais antigos que o prazo de retenção. */
  async expireAuditIps(now = new Date()): Promise<number> {
    const days = this.config.get('AUDIT_IP_RETENTION_DAYS', { infer: true });
    const cutoff = new Date(now.getTime() - days * DAY_IN_MS);

    return this.prisma.$transaction(async (tx) => {
      await enableAuditMaintenance(tx);
      const { count } = await tx.auditLog.updateMany({
        where: {
          occurredAt: { lt: cutoff },
          OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
        },
        data: { ip: null, userAgent: null },
      });
      return count;
    });
  }

  private async purgeClinic(
    tx: Tx,
    tenantId: string,
    scheduledFor: Date,
  ): Promise<void> {
    await enableAuditMaintenance(tx);

    // Anonimiza: mantém ids, ações e datas; remove nomes e dados de acesso
    await tx.auditLog.updateMany({
      where: { tenantId, actorType: 'USER' },
      data: { actorLabel: ANONYMIZED_USER },
    });
    await tx.auditLog.updateMany({
      where: { tenantId },
      data: { ip: null, userAgent: null, metadata: {} },
    });
    await tx.auditLog.updateMany({
      where: { tenantId, targetLabel: { not: null } },
      data: { targetLabel: ANONYMIZED_TARGET },
    });

    // Cascata: horários, usuários e sessões
    await tx.clinic.delete({ where: { id: tenantId } });

    // Prova da exclusão, sem dados pessoais
    await this.audit.log(tx, 'clinic.purged', {
      actor: SYSTEM_ACTOR,
      tenantId,
      target: { type: 'Clinic', id: tenantId, label: ANONYMIZED_CLINIC },
      metadata: { scheduledFor: scheduledFor.toISOString() },
    });
  }
}

/** Libera UPDATE/DELETE em audit_logs só até o fim desta transação. */
function enableAuditMaintenance(tx: Tx) {
  return tx.$executeRaw`SELECT set_config('app.audit_maintenance', 'on', true)`;
}
