import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePatientDto } from './dto/create-patient.dto.js';
import type { ListPatientsDto } from './dto/list-patients.dto.js';
import type { UpdatePatientDto } from './dto/update-patient.dto.js';
import {
  PATIENT_DETAILS_SELECT,
  PATIENT_SUMMARY_SELECT,
  type PatientDetails,
  type PatientPage,
} from './patient.types.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const DEFAULT_PAGE_SIZE = 20;

/** "1990-05-20" → data à meia-noite UTC (coluna @db.Date). */
const toDate = (value: string) => new Date(`${value}T00:00:00Z`);

export const patientTarget = (patient: { id: string; name: string }) => ({
  type: 'Patient',
  id: patient.id,
  label: patient.name,
});

/**
 * Cadastro de pacientes de uma clínica. Tudo passa pelo client restrito ao
 * tenant (filtro da aplicação + RLS): o CPF é único dentro da clínica, e o
 * mesmo CPF em outra clínica é um cadastro independente.
 */
@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListPatientsDto): Promise<PatientPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.listWhere(query);
    const db = this.prisma.forTenant(tenantId);

    const [items, total] = await Promise.all([
      db.patient.findMany({
        where,
        select: PATIENT_SUMMARY_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.patient.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Ficha do paciente. Cada abertura fica registrada na auditoria. */
  async findOne(tenantId: string, id: string): Promise<PatientDetails> {
    const db = this.prisma.forTenant(tenantId);
    const patient = await db.patient.findUnique({
      where: { id },
      select: PATIENT_DETAILS_SELECT,
    });
    if (!patient) throw new NotFoundException('Patient not found');

    await this.audit.log(db, 'patient.viewed', {
      target: patientTarget(patient),
    });
    return patient;
  }

  async create(
    tenantId: string,
    dto: CreatePatientDto,
  ): Promise<PatientDetails> {
    return this.withCpfConflict(() =>
      this.prisma.tenantTransaction(tenantId, async (tx) => {
        const patient = await tx.patient.create({
          data: {
            tenantId,
            name: dto.name,
            cpf: dto.cpf,
            birthDate: toDate(dto.birthDate),
            socialName: dto.socialName ?? null,
            gender: dto.gender ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            emergencyContactName: dto.emergencyContactName ?? null,
            emergencyContactPhone: dto.emergencyContactPhone ?? null,
          },
          select: PATIENT_DETAILS_SELECT,
        });
        await this.audit.log(tx, 'patient.created', {
          target: patientTarget(patient),
        });
        return patient;
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePatientDto,
  ): Promise<PatientDetails> {
    const current = await this.findOrFail(tenantId, id);
    const data = toUpdateData(dto);

    // Só os nomes dos campos que mudaram vão para o log, nunca os valores
    const changed = Object.keys(data).filter(
      (field) =>
        !sameValue(
          current[field as keyof PatientDetails],
          data[field as keyof typeof data],
        ),
    );
    if (changed.length === 0) return current;

    return this.withCpfConflict(() =>
      this.prisma.tenantTransaction(tenantId, async (tx) => {
        const patient = await tx.patient.update({
          where: { id },
          data,
          select: PATIENT_DETAILS_SELECT,
        });
        await this.audit.log(tx, 'patient.updated', {
          target: patientTarget(patient),
          metadata: { fields: changed },
        });
        return patient;
      }),
    );
  }

  async setActive(
    tenantId: string,
    id: string,
    active: boolean,
  ): Promise<PatientDetails> {
    const current = await this.findOrFail(tenantId, id);
    if (current.active === active) return current;

    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const patient = await tx.patient.update({
        where: { id },
        data: { active },
        select: PATIENT_DETAILS_SELECT,
      });
      await this.audit.log(
        tx,
        active ? 'patient.reactivated' : 'patient.deactivated',
        {
          target: patientTarget(patient),
          metadata: { active: { from: !active, to: active } },
        },
      );
      return patient;
    });
  }

  /** Busca sem registrar visualização (uso interno). */
  async findOrFail(tenantId: string, id: string): Promise<PatientDetails> {
    const patient = await this.prisma
      .forTenant(tenantId)
      .patient.findUnique({ where: { id }, select: PATIENT_DETAILS_SELECT });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  private listWhere(query: ListPatientsDto): Prisma.PatientWhereInput {
    const filters: Prisma.PatientWhereInput[] = [];
    const status = query.status ?? 'active';
    if (status !== 'all') filters.push({ active: status === 'active' });

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const byName: Prisma.PatientWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { socialName: { contains: search, mode: 'insensitive' } },
      ];
      // "123.456" ou "12345": também procura pelo início do CPF
      const looksLikeCpf = digits.length >= 3 && /^[\d.\-\s]+$/.test(search);
      filters.push({
        OR: looksLikeCpf
          ? [...byName, { cpf: { startsWith: digits } }]
          : byName,
      });
    }
    return { AND: filters };
  }

  private async withCpfConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw conflict('CPF_IN_USE', 'A patient with this CPF already exists');
      }
      throw error;
    }
  }
}

const EDITABLE_FIELDS = [
  'name',
  'cpf',
  'socialName',
  'gender',
  'phone',
  'email',
  'emergencyContactName',
  'emergencyContactPhone',
] as const;

/** Só os campos enviados; null limpa os opcionais. */
function toUpdateData(dto: UpdatePatientDto): Prisma.PatientUpdateInput {
  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (dto[field] !== undefined) data[field] = dto[field];
  }
  if (dto.birthDate !== undefined) data.birthDate = toDate(dto.birthDate);
  return data as Prisma.PatientUpdateInput;
}

function sameValue(current: unknown, next: unknown): boolean {
  if (current instanceof Date && next instanceof Date) {
    return current.getTime() === next.getTime();
  }
  return (current ?? null) === (next ?? null);
}
