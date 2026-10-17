import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ClinicResponse } from './dto/clinic-response.dto.js';
import type { CreateClinicDto } from './dto/create-clinic.dto.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria a clínica (tenant), seus horários e o usuário administrador numa
   * única escrita aninhada, que o Prisma executa em uma transação.
   */
  async create(dto: CreateClinicDto): Promise<ClinicResponse> {
    const passwordHash = await argon2.hash(dto.admin.password);

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
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          createdAt: true,
          businessHours: {
            select: { weekday: true, opensAt: true, closesAt: true },
            orderBy: { weekday: 'asc' },
          },
          users: {
            select: {
              id: true,
              tenantId: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return { clinic, admin: users[0] };
    } catch (error) {
      // A única restrição única nesta escrita é o e-mail do usuário.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }
}
