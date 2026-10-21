import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, hasRole } from '../auth/auth-user.js';
import { badRequest, conflict, forbidden } from '../common/api-error.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateAmendmentDto,
  CreateRecordDto,
} from './dto/create-record.dto.js';
import type { ListRecordsDto } from './dto/list-records.dto.js';
import {
  type PatientRecordEntry,
  type PatientRecordWithAmendments,
  RECORD_SELECT,
} from './patient.types.js';
import { patientTarget, PatientsService } from './patients.service.js';

/** Tolerância para relógios levemente adiantados no "data do atendimento". */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Prontuário: registros de atendimento imutáveis. Não há edição nem
 * exclusão; correções e complementos entram como adendo do registro
 * original, feito pelo próprio autor (ou por um admin).
 */
@Injectable()
export class PatientRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patients: PatientsService,
  ) {}

  async list(
    tenantId: string,
    patientId: string,
    query: ListRecordsDto,
  ): Promise<PatientRecordWithAmendments[]> {
    await this.patients.findOrFail(tenantId, patientId);

    return this.prisma.forTenant(tenantId).patientRecord.findMany({
      where: {
        patientId,
        amendsId: null,
        ...(query.professionalId
          ? { professionalId: query.professionalId }
          : {}),
      },
      select: {
        ...RECORD_SELECT,
        amendments: { select: RECORD_SELECT, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    auth: AuthUser,
    patientId: string,
    dto: CreateRecordDto,
  ): Promise<PatientRecordWithAmendments> {
    const patient = await this.patients.findOrFail(auth.tenantId, patientId);
    if (!patient.active) {
      throw conflict(
        'PATIENT_INACTIVE',
        'Cannot add records to an inactive patient',
      );
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (occurredAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException('occurredAt cannot be in the future');
    }

    return this.prisma.tenantTransaction(auth.tenantId, async (tx) => {
      const record = await tx.patientRecord.create({
        data: {
          tenantId: auth.tenantId,
          patientId,
          professionalId: auth.userId,
          occurredAt,
          notes: dto.notes,
        },
        select: RECORD_SELECT,
      });
      // O texto clínico nunca vai para o log, só a referência
      await this.audit.log(tx, 'patient_record.created', {
        target: patientTarget(patient),
        metadata: { recordId: record.id },
      });
      return { ...record, amendments: [] };
    });
  }

  async amend(
    auth: AuthUser,
    patientId: string,
    recordId: string,
    dto: CreateAmendmentDto,
  ): Promise<PatientRecordEntry> {
    const patient = await this.patients.findOrFail(auth.tenantId, patientId);
    const original = await this.prisma
      .forTenant(auth.tenantId)
      .patientRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          patientId: true,
          professionalId: true,
          amendsId: true,
        },
      });
    if (!original || original.patientId !== patientId) {
      throw new NotFoundException('Record not found');
    }
    if (original.amendsId) {
      throw badRequest(
        'INVALID_AMENDMENT',
        'Amend the original record, not another amendment',
      );
    }
    if (
      original.professionalId !== auth.userId &&
      !hasRole(auth, UserRole.ADMIN)
    ) {
      throw forbidden(
        'NOT_RECORD_AUTHOR',
        'Only the author (or an admin) can amend this record',
      );
    }

    return this.prisma.tenantTransaction(auth.tenantId, async (tx) => {
      const amendment = await tx.patientRecord.create({
        data: {
          tenantId: auth.tenantId,
          patientId,
          professionalId: auth.userId,
          notes: dto.notes,
          amendsId: original.id,
        },
        select: RECORD_SELECT,
      });
      await this.audit.log(tx, 'patient_record.amended', {
        target: patientTarget(patient),
        metadata: { recordId: amendment.id, amendsId: original.id },
      });
      return amendment;
    });
  }
}
