import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuditActorType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

const DEFAULT_LIMIT = 50;

/** Rótulo exibido ao master no lugar do nome de um paciente. */
export const REDACTED_PATIENT_LABEL = 'Paciente';

export interface ListOptions {
  /**
   * Visão do master: esconde o nome dos pacientes. Dados de saúde (inclusive
   * quem é paciente de qual clínica) ficam só com a clínica.
   */
  redactPatients?: boolean;
}

export interface AuditLogEntry {
  id: string;
  occurredAt: Date;
  action: string;
  tenantId: string | null;
  /** Nome da clínica (só na visão do master; null se foi excluída). */
  clinicName?: string | null;
  actor: { type: AuditActorType; id: string | null; label: string };
  target: { type: string; id: string | null; label: string | null } | null;
  metadata: Prisma.JsonValue;
  ip: string | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

type AuditLogRow = Prisma.AuditLogGetPayload<object>;

/** Leitura do histórico com paginação por cursor (occurredAt desc, id desc). */
@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Histórico de uma clínica, pelo client restrito a ela. */
  async listForTenant(
    tenantId: string,
    query: ListAuditLogsDto,
    options: ListOptions = {},
  ): Promise<AuditLogPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.prisma
      .forTenant(tenantId)
      .auditLog.findMany(this.findArgs(query, limit));
    return this.page(rows, limit, options);
  }

  /**
   * Histórico de toda a plataforma (master), com filtro opcional por clínica.
   * Os nomes de pacientes nunca aparecem aqui.
   */
  async listAll(
    query: ListAuditLogsDto & { tenantId?: string },
  ): Promise<AuditLogPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const args = this.findArgs(query, limit);
    if (query.tenantId) {
      args.where = { AND: [args.where ?? {}, { tenantId: query.tenantId }] };
    }
    const rows = await this.prisma.auditLog.findMany(args);
    const page = this.page(rows, limit, { redactPatients: true });

    // Nome das clínicas da página numa única consulta
    const tenantIds = [
      ...new Set(page.items.flatMap((item) => item.tenantId ?? [])),
    ];
    const clinics = await this.prisma.clinic.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const names = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
    for (const item of page.items) {
      item.clinicName = item.tenantId
        ? (names.get(item.tenantId) ?? null)
        : null;
    }
    return page;
  }

  private findArgs(
    query: ListAuditLogsDto,
    limit: number,
  ): Prisma.AuditLogFindManyArgs {
    const filters: Prisma.AuditLogWhereInput[] = [];
    if (query.action) filters.push({ action: query.action });
    if (query.actorId) filters.push({ actorId: query.actorId });
    if (query.from) filters.push({ occurredAt: { gte: new Date(query.from) } });
    if (query.to) filters.push({ occurredAt: { lt: new Date(query.to) } });

    if (query.cursor) {
      const { occurredAt, id } = decodeCursor(query.cursor);
      filters.push({
        OR: [
          { occurredAt: { lt: occurredAt } },
          { occurredAt, id: { lt: id } },
        ],
      });
    }

    return {
      where: { AND: filters },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      // Um a mais para saber se há próxima página
      take: limit + 1,
    };
  }

  private page(
    rows: AuditLogRow[],
    limit: number,
    { redactPatients = false }: ListOptions = {},
  ): AuditLogPage {
    const hasMore = rows.length > limit;
    const items = rows
      .slice(0, limit)
      .map(toEntry)
      .map((entry) => (redactPatients ? redactPatient(entry) : entry));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.occurredAt, last.id) : null,
    };
  }
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    action: row.action,
    tenantId: row.tenantId,
    actor: { type: row.actorType, id: row.actorId, label: row.actorLabel },
    target: row.targetType
      ? { type: row.targetType, id: row.targetId, label: row.targetLabel }
      : null,
    metadata: row.metadata,
    ip: row.ip,
  };
}

function redactPatient(entry: AuditLogEntry): AuditLogEntry {
  if (entry.target?.type !== 'Patient') return entry;
  return {
    ...entry,
    target: { ...entry.target, label: REDACTED_PATIENT_LABEL },
  };
}

export function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const occurredAt = new Date(iso ?? '');
  if (!id || Number.isNaN(occurredAt.getTime())) {
    throw new BadRequestException('Invalid cursor');
  }
  return { occurredAt, id };
}
