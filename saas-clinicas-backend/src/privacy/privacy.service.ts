import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import {
  type AuditLogEntry,
  AuditLogsService,
} from '../audit/audit-logs.service.js';
import {
  CLINIC_DETAILS_SELECT,
  ClinicsService,
  clinicTarget,
} from '../clinics/clinics.service.js';
import type { ClinicDetails } from '../clinics/dto/clinic-response.dto.js';
import { badRequest, conflict } from '../common/api-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TEAM_MEMBER_SELECT, type TeamMember } from '../users/team-member.js';
import { DELETION_GRACE_DAYS, withDeletionInfo } from './deletion-status.js';
import type { RequestDeletionDto } from './dto/request-deletion.dto.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface ClinicExport {
  format: 'saas-clinicas.clinic-export.v1';
  exportedAt: Date;
  clinic: ClinicDetails;
  users: TeamMember[];
  auditLogs: AuditLogEntry[];
  /** Só na exportação feita pela própria clínica. */
  patients?: unknown[];
  /** Na exportação do master: dados de saúde ficam só com a clínica. */
  patientsCount?: number;
}

export interface ExportOptions {
  /** Pacientes e prontuário: só para a clínica (controladora dos dados). */
  includeHealthData: boolean;
}

const CLEARED_DELETION = {
  deletionRequestedAt: null,
  deletionRequestedById: null,
  deletionReason: null,
  deletionScheduledFor: null,
};

const invalidState = (message: string) =>
  conflict('INVALID_DELETION_STATE', message);

/**
 * Direitos do titular (LGPD) no nível da clínica: exportação dos dados e
 * exclusão em duas etapas (o admin solicita, o master confirma) com carência
 * de 30 dias, em que a clínica fica somente leitura e o admin pode cancelar.
 * Cada transição é uma atualização condicional ao estado esperado, então
 * pedidos simultâneos não passam os dois.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clinics: ClinicsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Todos os dados da clínica, sem hashes de senha nem tokens. Pacientes e
   * prontuário só entram quando quem exporta é a própria clínica.
   */
  async exportClinic(
    tenantId: string,
    { includeHealthData }: ExportOptions,
  ): Promise<ClinicExport> {
    const db = this.prisma.forTenant(tenantId);
    const clinic = await this.clinics.findOne(tenantId);

    const [users, auditLogs, health] = await Promise.all([
      db.user.findMany({
        select: TEAM_MEMBER_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.allAuditLogs(tenantId, !includeHealthData),
      includeHealthData
        ? db.patient
            .findMany({
              orderBy: { name: 'asc' },
              include: {
                records: {
                  orderBy: { occurredAt: 'asc' },
                  include: {
                    professional: { select: { id: true, name: true } },
                  },
                },
                appointments: {
                  orderBy: { startsAt: 'asc' },
                  include: {
                    professional: { select: { id: true, name: true } },
                  },
                },
              },
            })
            .then((patients) => ({ patients }))
        : db.patient.count().then((patientsCount) => ({ patientsCount })),
    ]);
    await this.audit.log(db, 'clinic.data_exported', {
      target: clinicTarget(clinic),
      metadata: { includesHealthData: includeHealthData },
    });

    return {
      format: 'saas-clinicas.clinic-export.v1',
      exportedAt: new Date(),
      clinic,
      users,
      auditLogs,
      ...health,
    };
  }

  /** Admin da clínica pede a exclusão; aguarda a confirmação do master. */
  async requestDeletion(
    tenantId: string,
    requestedById: string,
    dto: RequestDeletionDto,
  ): Promise<ClinicDetails> {
    const clinic = await this.clinics.findOne(tenantId);
    if (dto.confirmationName !== clinic.name.trim()) {
      throw badRequest(
        'CONFIRMATION_MISMATCH',
        'Confirmation name does not match the clinic name',
      );
    }

    return this.transition(tenantId, {
      when: { deletionRequestedAt: null, deletionScheduledFor: null },
      data: {
        deletionRequestedAt: new Date(),
        deletionRequestedById: requestedById,
        deletionReason: dto.reason || null,
      },
      action: 'clinic.deletion_requested',
      // O motivo é texto livre: fica na clínica, não no log
      metadata: { hasReason: Boolean(dto.reason) },
      invalidMessage: 'A deletion request already exists',
    });
  }

  /**
   * Admin desiste: antes da confirmação do master ou durante a carência.
   * A clínica volta ao normal (sai do modo somente leitura).
   */
  cancelRequest(tenantId: string): Promise<ClinicDetails> {
    return this.transition(tenantId, {
      when: { deletionRequestedAt: { not: null } },
      data: CLEARED_DELETION,
      action: 'clinic.deletion_cancelled',
      invalidMessage: 'There is no deletion to cancel',
    });
  }

  /**
   * Master confirma: agenda a exclusão definitiva. Durante a carência a
   * equipe continua entrando, mas só para consultar (somente leitura).
   */
  async confirmDeletion(tenantId: string): Promise<ClinicDetails> {
    const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * DAY_IN_MS);
    return this.transition(tenantId, {
      when: { deletionRequestedAt: { not: null }, deletionScheduledFor: null },
      data: { deletionScheduledFor: scheduledFor },
      action: 'clinic.deletion_confirmed',
      metadata: { scheduledFor: scheduledFor.toISOString() },
      invalidMessage: 'There is no pending deletion request',
    });
  }

  /** Master recusa o pedido. */
  rejectDeletion(tenantId: string): Promise<ClinicDetails> {
    return this.transition(tenantId, {
      when: { deletionRequestedAt: { not: null }, deletionScheduledFor: null },
      data: CLEARED_DELETION,
      action: 'clinic.deletion_rejected',
      invalidMessage: 'There is no pending deletion request',
    });
  }

  /** Master cancela durante a carência: a clínica volta ao normal. */
  cancelScheduledDeletion(tenantId: string): Promise<ClinicDetails> {
    return this.transition(tenantId, {
      when: { deletionScheduledFor: { not: null } },
      data: CLEARED_DELETION,
      action: 'clinic.deletion_cancelled',
      invalidMessage: 'There is no scheduled deletion',
    });
  }

  private async transition(
    tenantId: string,
    step: {
      when: Prisma.ClinicWhereInput;
      data: Prisma.ClinicUpdateManyMutationInput;
      action:
        | 'clinic.deletion_requested'
        | 'clinic.deletion_cancelled'
        | 'clinic.deletion_confirmed'
        | 'clinic.deletion_rejected';
      metadata?: Record<string, string | boolean>;
      invalidMessage: string;
    },
  ): Promise<ClinicDetails> {
    await this.clinics.findOne(tenantId); // 404 se não existir

    const clinic = await this.prisma.tenantTransaction(tenantId, async (tx) => {
      const { count } = await tx.clinic.updateMany({
        where: step.when,
        data: step.data,
      });
      if (count === 0) throw invalidState(step.invalidMessage);

      const updated = await tx.clinic.findFirstOrThrow({
        select: CLINIC_DETAILS_SELECT,
      });
      await this.audit.log(tx, step.action, {
        target: clinicTarget(updated),
        metadata: step.metadata ?? {},
      });
      return updated;
    });
    return withDeletionInfo(clinic);
  }

  private async allAuditLogs(
    tenantId: string,
    redactPatients: boolean,
  ): Promise<AuditLogEntry[]> {
    const entries: AuditLogEntry[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.auditLogs.listForTenant(
        tenantId,
        { cursor, limit: 100 },
        { redactPatients },
      );
      entries.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return entries;
  }
}
