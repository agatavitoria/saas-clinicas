import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { conflict } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import { TEAM_MEMBER_SELECT, type TeamMember } from './team-member.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const userTarget = (user: { id: string; name: string }) => ({
  type: 'User',
  id: user.id,
  label: user.name,
});

/**
 * Gestão da equipe de uma clínica. Toda operação recebe o tenant e usa o
 * client restrito a ele: um id de outra clínica simplesmente não existe.
 * Cada alteração é auditada na mesma transação.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(tenantId: string): Promise<TeamMember[]> {
    return this.prisma.forTenant(tenantId).user.findMany({
      select: TEAM_MEMBER_SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<TeamMember> {
    const passwordHash = await argon2.hash(dto.temporaryPassword);

    try {
      return await this.prisma.tenantTransaction(tenantId, async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            name: dto.name,
            email: dto.email,
            roles: dto.roles,
            passwordHash,
            mustChangePassword: true,
          },
          select: TEAM_MEMBER_SELECT,
        });
        await this.audit.log(tx, 'user.created', {
          target: userTarget(user),
          metadata: { roles: user.roles },
        });
        return user;
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
    const user = await db.user.findUnique({
      where: { id: userId },
      select: TEAM_MEMBER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.active === active) return user;

    if (!active) {
      if (userId === actorUserId) {
        throw conflict(
          'CANNOT_DEACTIVATE_SELF',
          'You cannot deactivate yourself',
        );
      }
      if (user.roles.includes(UserRole.ADMIN)) {
        await this.ensureAnotherActiveAdmin(tenantId);
      }
    }

    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { active },
        select: TEAM_MEMBER_SELECT,
      });
      if (!active) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(
        tx,
        active ? 'user.reactivated' : 'user.deactivated',
        {
          target: userTarget(updated),
          metadata: { active: { from: !active, to: active } },
        },
      );
      return updated;
    });
  }

  /**
   * Define os papéis do usuário (pelo menos um). Ninguém tira o próprio papel
   * de admin, e a clínica nunca fica sem um admin ativo.
   */
  async setRoles(
    tenantId: string,
    userId: string,
    roles: UserRole[],
    actorUserId?: string,
  ): Promise<TeamMember> {
    const db = this.prisma.forTenant(tenantId);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: TEAM_MEMBER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');

    const next = [...new Set(roles)].sort();
    const current = [...user.roles].sort();
    if (next.join() === current.join()) return user;

    const losesAdmin =
      current.includes(UserRole.ADMIN) && !next.includes(UserRole.ADMIN);
    if (losesAdmin) {
      if (userId === actorUserId) {
        throw conflict(
          'CANNOT_REMOVE_OWN_ADMIN',
          'You cannot remove your own admin role',
        );
      }
      if (user.active) await this.ensureAnotherActiveAdmin(tenantId);
    }

    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { roles: next },
        select: TEAM_MEMBER_SELECT,
      });
      await this.audit.log(tx, 'user.roles_changed', {
        target: userTarget(updated),
        metadata: { roles: { from: current, to: next } },
      });
      return updated;
    });
  }

  /** Define uma nova senha provisória e encerra as sessões do usuário. */
  async resetPassword(
    tenantId: string,
    userId: string,
    temporaryPassword: string,
  ): Promise<TeamMember> {
    const exists = await this.prisma
      .forTenant(tenantId)
      .user.count({ where: { id: userId } });
    if (!exists) throw new NotFoundException('User not found');

    const passwordHash = await argon2.hash(temporaryPassword);
    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true },
        select: TEAM_MEMBER_SELECT,
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(tx, 'user.password_reset', {
        target: userTarget(updated),
      });
      return updated;
    });
  }

  /** Falha se o usuário em questão for o único admin ativo da clínica. */
  private async ensureAnotherActiveAdmin(tenantId: string): Promise<void> {
    const activeAdmins = await this.prisma.forTenant(tenantId).user.count({
      where: { roles: { has: UserRole.ADMIN }, active: true },
    });
    if (activeAdmins <= 1) {
      throw conflict(
        'LAST_ACTIVE_ADMIN',
        'The clinic must keep at least one active admin',
      );
    }
  }
}
