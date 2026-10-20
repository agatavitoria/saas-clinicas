import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { USER_PROFILE_SELECT } from '../auth/auth-user.js';
import { conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from './dto/clinic-response.dto.js';
import type { CreateClinicDto } from './dto/create-clinic.dto.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const CLINIC_DETAILS_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  document: true,
  active: true,
  createdAt: true,
  businessHours: {
    select: { weekday: true, opensAt: true, closesAt: true },
    orderBy: { weekday: 'asc' },
  },
} as const;

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria a clínica (tenant), seus horários e o usuário administrador numa
   * única escrita aninhada, que o Prisma executa em uma transação. O admin
   * recebe uma senha provisória e precisa trocá-la no primeiro login.
   */
  async create(dto: CreateClinicDto): Promise<ClinicResponse> {
    const passwordHash = await argon2.hash(dto.admin.temporaryPassword);

    try {
      const { users, ...clinic } = await this.prisma.clinic.create({
        data: {
          name: dto.clinic.name,
          email: dto.clinic.email,
          phone: dto.clinic.phone,
          document: dto.clinic.document ?? null,
          businessHours: {
            create: dto.businessHours.map(({ weekday, opensAt, closesAt }) => ({
              weekday,
              opensAt,
              closesAt,
            })),
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

      return { clinic, admin: users[0] };
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
  findCurrent(tenantId: string): Promise<ClinicDetails> {
    return this.prisma
      .forTenant(tenantId)
      .clinic.findFirstOrThrow({ select: CLINIC_DETAILS_SELECT });
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
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return clinics.map(({ _count, ...clinic }) => ({
      ...clinic,
      usersCount: _count.users,
    }));
  }

  async findOne(id: string): Promise<ClinicDetails> {
    const clinic = await this.prisma
      .forTenant(id)
      .clinic.findFirst({ select: CLINIC_DETAILS_SELECT });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  /** Ativa ou inativa a clínica. Inativar encerra as sessões de toda a equipe. */
  async setActive(id: string, active: boolean): Promise<ClinicDetails> {
    await this.findOne(id);

    const db = this.prisma.forTenant(id);
    const [clinic] = await db.$transaction([
      db.clinic.update({
        where: { id },
        data: { active },
        select: CLINIC_DETAILS_SELECT,
      }),
      ...(active
        ? []
        : [
            db.refreshToken.updateMany({
              where: { revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);
    return clinic;
  }
}
