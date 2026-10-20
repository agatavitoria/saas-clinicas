import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { type AuditActor, SYSTEM_ACTOR } from '../audit/audit-context.js';
import { AuditService } from '../audit/audit.service.js';
import type { SessionTokens } from '../auth/auth-cookies.service.js';
import {
  PLATFORM_ADMIN_PROFILE_SELECT,
  type PlatformAccessTokenPayload,
  type PlatformAdminProfile,
} from '../auth/auth-user.js';
import { PLATFORM_AUDIENCE } from '../auth/auth.constants.js';
import { RefreshTokenRotation } from '../auth/refresh-token-rotation.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PlatformSession extends SessionTokens {
  admin: PlatformAdminProfile;
}

const adminActor = (admin: PlatformAdminProfile): AuditActor => ({
  type: 'PLATFORM_ADMIN',
  id: admin.id,
  label: admin.name,
  tenantId: null,
});

/** Sessões dos administradores da plataforma (master). */
@Injectable()
export class PlatformAuthService {
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  private readonly refreshTokens: RefreshTokenRotation<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    const tokens = prisma.platformRefreshToken;
    const revokedNow = () => ({ revokedAt: new Date() });

    // O dono do token é o id do admin
    this.refreshTokens = new RefreshTokenRotation<string>(
      {
        create: async (adminId, tokenHash, expiresAt) => {
          await tokens.create({ data: { adminId, tokenHash, expiresAt } });
        },
        findByHash: async (tokenHash) => {
          const token = await tokens.findUnique({ where: { tokenHash } });
          return token && { ...token, owner: token.adminId };
        },
        revoke: async ({ id }) => {
          const { count } = await tokens.updateMany({
            where: { id, revokedAt: null },
            data: revokedNow(),
          });
          return count === 1;
        },
        revokeAllOf: async (adminId) => {
          await tokens.updateMany({
            where: { adminId, revokedAt: null },
            data: revokedNow(),
          });
        },
        revokeByHash: async (tokenHash) => {
          const token = await tokens.findUnique({ where: { tokenHash } });
          if (!token) return null;
          const { count } = await tokens.updateMany({
            where: { id: token.id, revokedAt: null },
            data: revokedNow(),
          });
          return count === 1 ? token.adminId : null;
        },
      },
      {
        ttlDays: config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }),
        onReuseDetected: (adminId) =>
          this.audit.log(prisma, 'auth.session_reuse_detected', {
            actor: SYSTEM_ACTOR,
            tenantId: null,
            target: { type: 'PlatformAdmin', id: adminId },
          }),
      },
    );
  }

  async login(email: string, password: string): Promise<PlatformSession> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email },
      select: {
        ...PLATFORM_ADMIN_PROFILE_SELECT,
        passwordHash: true,
        active: true,
      },
    });

    const valid = await argon2.verify(
      admin?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!admin || !valid || !admin.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _, active: __, ...profile } = admin;
    const session = await this.createSession(profile);
    await this.audit.log(this.prisma, 'platform.logged_in', {
      actor: adminActor(profile),
    });
    return session;
  }

  async refresh(refreshToken: string | undefined): Promise<PlatformSession> {
    const adminId = await this.refreshTokens.consume(refreshToken);

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { ...PLATFORM_ADMIN_PROFILE_SELECT, active: true },
    });
    if (!admin?.active) throw new UnauthorizedException();

    const { active: _, ...profile } = admin;
    return this.createSession(profile);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    const adminId = await this.refreshTokens.revoke(refreshToken);
    if (!adminId) return;

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: PLATFORM_ADMIN_PROFILE_SELECT,
    });
    if (admin) {
      await this.audit.log(this.prisma, 'platform.logged_out', {
        actor: adminActor(admin),
      });
    }
  }

  async getProfile(adminId: string): Promise<PlatformAdminProfile> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: PLATFORM_ADMIN_PROFILE_SELECT,
    });
    if (!admin) throw new UnauthorizedException();
    return admin;
  }

  private async createSession(
    admin: PlatformAdminProfile,
  ): Promise<PlatformSession> {
    const payload: PlatformAccessTokenPayload = { sub: admin.id };
    const accessToken = await this.jwt.signAsync(payload, {
      audience: PLATFORM_AUDIENCE,
    });
    const refresh = await this.refreshTokens.issue(admin.id);

    return {
      admin,
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}
