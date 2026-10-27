import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { USER_PROFILE_SELECT } from '../auth/auth-user.js';
import { badRequest, conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  DELETION_FIELDS_SELECT,
  withDeletionInfo,
} from '../privacy/deletion-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLINIC_BRANDING_SELECT } from './branding.js';
import type {
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from './dto/clinic-response.dto.js';
import type {
  BusinessHourDto,
  CreateClinicDto,
} from './dto/create-clinic.dto.js';
import type { UpdateScheduleSettingsDto } from './dto/update-schedule-settings.dto.js';
import { isReservedSlug } from './slug.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** Violação de unicidade, opcionalmente restrita a um campo. */
function isUniqueViolation(error: unknown, field?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return false;
  }
  // O formato do meta varia com o driver: basta o campo aparecer nele
  return !field || JSON.stringify(error.meta ?? {}).includes(field);
}

function assertSlugAllowed(slug: string): void {
  if (isReservedSlug(slug)) {
    throw badRequest('SLUG_RESERVED', 'This address is reserved');
  }
}

const slugTaken = () =>
  conflict('SLUG_TAKEN', 'This address is already used by another clinic');

export const CLINIC_DETAILS_SELECT = {
  id: true,
  name: true,
  slug: true,
  email: true,
  phone: true,
  document: true,
  timeZone: true,
  defaultAppointmentMinutes: true,
  active: true,
  createdAt: true,
  ...DELETION_FIELDS_SELECT,
  businessHours: {
    select: { weekday: true, opensAt: true, closesAt: true },
    orderBy: { weekday: 'asc' },
  },
  branding: { select: CLINIC_BRANDING_SELECT },
} as const;

export const clinicTarget = (clinic: { id: string; name: string }) => ({
  type: 'Clinic',
  id: clinic.id,
  label: clinic.name,
});

@Injectable()
export class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria a clínica (tenant), seus horários e o usuário administrador numa
   * única transação, junto com os registros de auditoria. O admin recebe uma
   * senha provisória e precisa trocá-la no primeiro login.
   */
  async create(dto: CreateClinicDto): Promise<ClinicResponse> {
    assertSlugAllowed(dto.clinic.slug);
    const passwordHash = await argon2.hash(dto.admin.temporaryPassword);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { users, ...clinic } = await tx.clinic.create({
          data: {
            name: dto.clinic.name,
            slug: dto.clinic.slug,
            email: dto.clinic.email,
            phone: dto.clinic.phone,
            document: dto.clinic.document ?? null,
            businessHours: {
              create: dto.businessHours.map(
                ({ weekday, opensAt, closesAt }) => ({
                  weekday,
                  opensAt,
                  closesAt,
                }),
              ),
            },
            users: {
              create: {
                name: dto.admin.name,
                email: dto.admin.email,
                passwordHash,
                roles: [UserRole.ADMIN],
                mustChangePassword: true,
              },
            },
          },
          select: {
            ...CLINIC_DETAILS_SELECT,
            users: { select: USER_PROFILE_SELECT },
          },
        });
        const admin = users[0];

        await this.audit.log(tx, 'clinic.created', {
          tenantId: clinic.id,
          target: clinicTarget(clinic),
        });
        await this.audit.log(tx, 'user.created', {
          tenantId: clinic.id,
          target: { type: 'User', id: admin.id, label: admin.name },
          metadata: { roles: admin.roles },
        });

        return { clinic: withDeletionInfo(clinic), admin };
      });
    } catch (error) {
      // As restrições únicas desta escrita: o slug da clínica e o e-mail do admin
      if (isUniqueViolation(error, 'slug')) throw slugTaken();
      if (isUniqueViolation(error)) {
        throw conflict('EMAIL_IN_USE', 'Email already in use');
      }
      throw error;
    }
  }

  /** Clínica do tenant autenticado. */
  async findCurrent(tenantId: string): Promise<ClinicDetails> {
    const clinic = await this.prisma
      .forTenant(tenantId)
      .clinic.findFirstOrThrow({ select: CLINIC_DETAILS_SELECT });
    return withDeletionInfo(clinic);
  }

  /** Todas as clínicas (uso exclusivo do admin master). */
  async findAll(): Promise<ClinicSummary[]> {
    const clinics = await this.prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        active: true,
        createdAt: true,
        ...DELETION_FIELDS_SELECT,
        _count: { select: { users: true, patients: true } },
      },
      orderBy: { name: 'asc' },
    });

    return clinics.map(({ _count, ...clinic }) => ({
      ...withDeletionInfo(clinic),
      usersCount: _count.users,
      patientsCount: _count.patients,
    }));
  }

  async findOne(id: string): Promise<ClinicDetails> {
    const clinic = await this.prisma
      .forTenant(id)
      .clinic.findFirst({ select: CLINIC_DETAILS_SELECT });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return withDeletionInfo(clinic);
  }

  /**
   * Renomeia a clínica (admin ou master). O nome não vai no metadata da
   * auditoria: pode ser o nome de uma pessoa (ex.: consultório).
   */
  async rename(id: string, name: string): Promise<ClinicDetails> {
    const current = await this.findOne(id);
    if (current.name === name) return current;

    const clinic = await this.prisma.tenantTransaction(id, async (tx) => {
      const updated = await tx.clinic.update({
        where: { id },
        data: { name },
        select: CLINIC_DETAILS_SELECT,
      });
      await this.audit.log(tx, 'clinic.renamed', {
        target: clinicTarget(updated),
      });
      return updated;
    });
    return withDeletionInfo(clinic);
  }

  /** Fuso e duração padrão da agenda. O log leva os valores antigos e novos. */
  async updateScheduleSettings(
    id: string,
    dto: UpdateScheduleSettingsDto,
  ): Promise<ClinicDetails> {
    const current = await this.findOne(id);
    const changes: Record<
      string,
      { from: string | number; to: string | number }
    > = {};
    for (const field of ['timeZone', 'defaultAppointmentMinutes'] as const) {
      if (dto[field] !== undefined && dto[field] !== current[field]) {
        changes[field] = { from: current[field], to: dto[field] };
      }
    }
    if (Object.keys(changes).length === 0) return current;

    const clinic = await this.prisma.tenantTransaction(id, async (tx) => {
      const updated = await tx.clinic.update({
        where: { id },
        data: Object.fromEntries(
          Object.entries(changes).map(([field, { to }]) => [field, to]),
        ),
        select: CLINIC_DETAILS_SELECT,
      });
      await this.audit.log(tx, 'clinic.schedule_settings_updated', {
        target: clinicTarget(updated),
        metadata: changes,
      });
      return updated;
    });
    return withDeletionInfo(clinic);
  }

  /** Substitui o horário de funcionamento da semana inteira. */
  async updateBusinessHours(
    id: string,
    hours: BusinessHourDto[],
  ): Promise<ClinicDetails> {
    const current = await this.findOne(id);
    const next = [...hours]
      .sort((a, b) => a.weekday - b.weekday)
      .map(({ weekday, opensAt, closesAt }) => ({
        weekday,
        opensAt,
        closesAt,
      }));
    if (sameHours(current.businessHours, next)) return current;

    const clinic = await this.prisma.tenantTransaction(id, async (tx) => {
      await tx.clinicBusinessHour.deleteMany({});
      await tx.clinicBusinessHour.createMany({
        data: next.map((hour) => ({ tenantId: id, ...hour })),
      });
      const updated = await tx.clinic.findFirstOrThrow({
        select: CLINIC_DETAILS_SELECT,
      });
      await this.audit.log(tx, 'clinic.business_hours_updated', {
        target: clinicTarget(updated),
        metadata: {
          businessHours: {
            from: current.businessHours.map(formatHour),
            to: next.map(formatHour),
          },
        },
      });
      return updated;
    });
    return withDeletionInfo(clinic);
  }

  /** Ativa ou inativa a clínica. Inativar encerra as sessões de toda a equipe. */
  async setActive(id: string, active: boolean): Promise<ClinicDetails> {
    const current = await this.findOne(id);
    if (current.active === active) return current;

    const clinic = await this.prisma.tenantTransaction(id, async (tx) => {
      const updated = await tx.clinic.update({
        where: { id },
        data: { active },
        select: CLINIC_DETAILS_SELECT,
      });
      if (!active) {
        await tx.refreshToken.updateMany({
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(
        tx,
        active ? 'clinic.reactivated' : 'clinic.deactivated',
        {
          target: clinicTarget(updated),
          metadata: { active: { from: !active, to: active } },
        },
      );
      return updated;
    });
    return withDeletionInfo(clinic);
  }
}

interface Hour {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

/** Ex.: "1 08:00-18:00" (segunda); compacto para o log de auditoria. */
const formatHour = (hour: Hour) =>
  `${hour.weekday} ${hour.opensAt}-${hour.closesAt}`;

/** As duas listas estão ordenadas por dia da semana. */
const sameHours = (a: Hour[], b: Hour[]) =>
  a.length === b.length &&
  a.every((hour, index) => formatHour(hour) === formatHour(b[index]));
