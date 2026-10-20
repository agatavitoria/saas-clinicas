import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import { TEAM_MEMBER_SELECT, type TeamMember } from './team-member.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

type TenantDb = ReturnType<PrismaService['forTenant']>;

const revokeSessions = (db: TenantDb, userId: string) =>
  db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

/**
 * Gestão da equipe de uma clínica. Toda operação recebe o tenant e usa o
 * client restrito a ele: um id de outra clínica simplesmente não existe.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string): Promise<TeamMember[]> {
    return this.prisma.forTenant(tenantId).user.findMany({
      select: TEAM_MEMBER_SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<TeamMember> {
    try {
      return await this.prisma.forTenant(tenantId).user.create({
        data: {
          tenantId,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          passwordHash: await argon2.hash(dto.temporaryPassword),
          mustChangePassword: true,
        },
        select: TEAM_MEMBER_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw conflict('EMAIL_IN_USE', 'Email already in use');
      }
      throw error;
    }
  }

  /**
   * Ativa ou inativa um usuário. Inativar encerra as sessões dele na hora.
   * @param actorUserId quem está fazendo a mudança (não pode se inativar)
   */
  async setActive(
    tenantId: string,
    userId: string,
    active: boolean,
    actorUserId?: string,
  ): Promise<TeamMember> {
    const db = this.prisma.forTenant(tenantId);
    const user = await this.findOrFail(tenantId, userId);

    if (!active) {
      if (userId === actorUserId) {
        throw conflict(
          'CANNOT_DEACTIVATE_SELF',
          'You cannot deactivate yourself',
        );
      }
      if (user.role === UserRole.ADMIN && user.active) {
        const activeAdmins = await db.user.count({
          where: { role: UserRole.ADMIN, active: true },
        });
        if (activeAdmins <= 1) {
          throw conflict(
            'LAST_ACTIVE_ADMIN',
            'The clinic must keep at least one active admin',
          );
        }
      }
    }

    const [updated] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { active },
        select: TEAM_MEMBER_SELECT,
      }),
      ...(active ? [] : [revokeSessions(db, userId)]),
    ]);
    return updated;
  }

  /** Define uma nova senha provisória e encerra as sessões do usuário. */
  async resetPassword(
    tenantId: string,
    userId: string,
    temporaryPassword: string,
  ): Promise<TeamMember> {
    await this.findOrFail(tenantId, userId);

    const db = this.prisma.forTenant(tenantId);
    const [updated] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          passwordHash: await argon2.hash(temporaryPassword),
          mustChangePassword: true,
        },
        select: TEAM_MEMBER_SELECT,
      }),
      revokeSessions(db, userId),
    ]);
    return updated;
  }

  private async findOrFail(tenantId: string, userId: string) {
    const user = await this.prisma.forTenant(tenantId).user.findUnique({
      where: { id: userId },
      select: { role: true, active: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
