import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { USER_PROFILE_SELECT } from '../auth/auth-user.js';
import { conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  DELETION_FIELDS_SELECT,
  withDeletionInfo,
} from '../privacy/deletion-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from './dto/clinic-response.dto.js';
import type { CreateClinicDto } from './dto/create-clinic.dto.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export const CLINIC_DETAILS_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  document: true,
  active: true,
  createdAt: true,
  ...DELETION_FIELDS_SELECT,
  businessHours: {
    select: { weekday: true, opensAt: true, closesAt: true },
    orderBy: { weekday: 'asc' },
  },
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
    const passwordHash = await argon2.hash(dto.admin.temporaryPassword);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { users, ...clinic } = await tx.clinic.create({
          data: {
            name: dto.clinic.name,
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
                role: UserRole.ADMIN,
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
          metadata: { role: admin.role },
        });

        return { clinic: withDeletionInfo(clinic), admin };
      });
    } catch (error) {
      // A única restrição única nesta escrita é o e-mail do usuário.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
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
        email: true,
        phone: true,
        active: true,
        createdAt: true,
        ...DELETION_FIELDS_SELECT,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return clinics.map(({ _count, ...clinic }) => ({
      ...withDeletionInfo(clinic),
      usersCount: _count.users,
    }));
  }

  async findOne(id: string): Promise<ClinicDetails> {
    const clinic = await this.prisma
      .forTenant(id)
      .clinic.findFirst({ select: CLINIC_DETAILS_SELECT });
    if (!clinic) throw new NotFoundException('Clinic not found');
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
