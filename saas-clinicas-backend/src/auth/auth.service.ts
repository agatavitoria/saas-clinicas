import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { type AuditActor, SYSTEM_ACTOR } from '../audit/audit-context.js';
import { AuditService } from '../audit/audit.service.js';
import { CLINIC_BRANDING_SELECT } from '../clinics/branding.js';
import type { ClinicBrandingInfo } from '../clinics/dto/clinic-response.dto.js';
import { badRequest, forbidden } from '../common/api-error.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionTokens } from './auth-cookies.service.js';
import {
  type AuthUser,
  type TenantAccessTokenPayload,
  USER_PROFILE_SELECT,
  type UserProfile,
} from './auth-user.js';
import { TENANT_AUDIENCE } from './auth.constants.js';
import { RefreshTokenRotation } from './refresh-token-rotation.js';

export interface Session extends SessionTokens {
  user: UserProfile;
}

/** Resposta do /auth/me: a cor e o logo vêm junto para a tela não "piscar". */
export interface CurrentUserProfile extends UserProfile {
  branding: ClinicBrandingInfo | null;
}

const userActor = (user: {
  id: string;
  name: string;
  tenantId: string;
}): AuditActor => ({
  type: 'USER',
  id: user.id,
  label: user.name,
  tenantId: user.tenantId,
});

interface TenantTokenOwner {
  userId: string;
  tenantId: string;
}

/** Sessões dos usuários de clínica. */
@Injectable()
export class AuthService {
  /**
   * Hash verificado quando o e-mail não existe, para que a resposta leve o
   * mesmo tempo e não revele quais e-mails estão cadastrados.
   */
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  private readonly refreshTokens: RefreshTokenRotation<TenantTokenOwner>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    const revokedNow = () => ({ revokedAt: new Date() });

    this.refreshTokens = new RefreshTokenRotation<TenantTokenOwner>(
      {
        create: async ({ userId, tenantId }, tokenHash, expiresAt) => {
          await prisma.forTenant(tenantId).refreshToken.create({
            data: { tenantId, userId, tokenHash, expiresAt },
          });
        },
        // O token identifica o tenant, então a busca é a única sem escopo
        findByHash: async (tokenHash) => {
          const token = await prisma.refreshToken.findUnique({
            where: { tokenHash },
          });
          return (
            token && {
              id: token.id,
              expiresAt: token.expiresAt,
              revokedAt: token.revokedAt,
              owner: { userId: token.userId, tenantId: token.tenantId },
            }
          );
        },
        revoke: async ({ id, owner }) => {
          const { count } = await prisma
            .forTenant(owner.tenantId)
            .refreshToken.updateMany({
              where: { id, revokedAt: null },
              data: revokedNow(),
            });
          return count === 1;
        },
        revokeAllOf: async ({ userId, tenantId }) => {
          await prisma.forTenant(tenantId).refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: revokedNow(),
          });
        },
        revokeByHash: async (tokenHash) => {
          const token = await prisma.refreshToken.findUnique({
            where: { tokenHash },
          });
          if (!token) return null;
          const { count } = await prisma
            .forTenant(token.tenantId)
            .refreshToken.updateMany({
              where: { id: token.id, revokedAt: null },
              data: revokedNow(),
            });
          return count === 1
            ? { userId: token.userId, tenantId: token.tenantId }
            : null;
        },
      },
      {
        ttlDays: config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }),
        onReuseDetected: (owner) =>
          this.audit.log(
            prisma.forTenant(owner.tenantId),
            'auth.session_reuse_detected',
            { actor: SYSTEM_ACTOR, target: { type: 'User', id: owner.userId } },
          ),
      },
    );
  }

  /**
   * Login no subdomínio de uma clínica (`clinicSlug`). O usuário de outra
   * clínica recebe a mesma resposta de senha errada, para não revelar que o
   * e-mail existe em outro lugar.
   */
  async login(
    email: string,
    password: string,
    clinicSlug: string,
  ): Promise<Session> {
    // O login é a única busca de usuário sem tenant: o e-mail é único na
    // plataforma e é ele que identifica a clínica.
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...USER_PROFILE_SELECT,
        passwordHash: true,
        active: true,
        clinic: { select: { active: true, slug: true } },
      },
    });

    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !valid || user.clinic.slug !== clinicSlug) {
      // TODO(audit): registrar auth.login_failed (só para e-mails de usuários
      // existentes, para não guardar e-mails digitados por engano)
      throw new UnauthorizedException('Invalid email or password');
    }

    // Só revelamos a inativação para quem acertou a senha
    if (!user.active) throw forbidden('USER_INACTIVE', 'User is inactive');
    if (!user.clinic.active) {
      throw forbidden('CLINIC_INACTIVE', 'Clinic is inactive');
    }

    const { passwordHash: _, active: __, clinic: ___, ...profile } = user;
    const session = await this.createSession(profile);
    await this.audit.log(
      this.prisma.forTenant(profile.tenantId),
      'auth.logged_in',
      {
        actor: userActor(profile),
        target: { type: 'User', id: profile.id, label: profile.name },
      },
    );
    return session;
  }

  /** Emite access token e um novo refresh token persistido. */
  async createSession(user: UserProfile): Promise<Session> {
    const payload: TenantAccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      audience: TENANT_AUDIENCE,
    });
    const refresh = await this.refreshTokens.issue({
      userId: user.id,
      tenantId: user.tenantId,
    });

    return {
      user,
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  /** Troca o refresh token por uma nova sessão (rotação). */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    const owner = await this.refreshTokens.consume(refreshToken);

    const user = await this.prisma.forTenant(owner.tenantId).user.findUnique({
      where: { id: owner.userId },
      select: {
        ...USER_PROFILE_SELECT,
        active: true,
        clinic: { select: { active: true } },
      },
    });
    if (!user?.active || !user.clinic.active) {
      throw new UnauthorizedException();
    }

    const { active: _, clinic: __, ...profile } = user;
    return this.createSession(profile);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    const owner = await this.refreshTokens.revoke(refreshToken);
    if (!owner) return;

    const db = this.prisma.forTenant(owner.tenantId);
    const user = await db.user.findUnique({
      where: { id: owner.userId },
      select: { id: true, name: true, tenantId: true },
    });
    if (user) {
      await this.audit.log(db, 'auth.logged_out', {
        actor: userActor(user),
        target: { type: 'User', id: user.id, label: user.name },
      });
    }
  }

  /** Perfil do usuário logado, com a identidade visual da clínica. */
  async getProfile(
    userId: string,
    tenantId: string,
  ): Promise<CurrentUserProfile> {
    const user = await this.prisma.forTenant(tenantId).user.findUnique({
      where: { id: userId },
      select: {
        ...USER_PROFILE_SELECT,
        clinic: { select: { branding: { select: CLINIC_BRANDING_SELECT } } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const { clinic, ...profile } = user;
    return { ...profile, branding: clinic.branding };
  }

  /**
   * Troca a senha (inclusive a provisória), encerra as outras sessões e
   * devolve uma sessão nova.
   */
  async changePassword(
    auth: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<Session> {
    const db = this.prisma.forTenant(auth.tenantId);
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException();

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw badRequest(
        'INVALID_CURRENT_PASSWORD',
        'Current password is incorrect',
      );
    }
    if (currentPassword === newPassword) {
      throw badRequest(
        'SAME_PASSWORD',
        'New password must differ from the current one',
      );
    }

    const passwordHash = await argon2.hash(newPassword);
    const profile = await this.prisma.tenantTransaction(
      auth.tenantId,
      async (tx) => {
        const updated = await tx.user.update({
          where: { id: auth.userId },
          data: { passwordHash, mustChangePassword: false },
          select: USER_PROFILE_SELECT,
        });
        await tx.refreshToken.updateMany({
          where: { userId: auth.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.log(tx, 'auth.password_changed', {
          target: { type: 'User', id: updated.id, label: updated.name },
        });
        return updated;
      },
    );

    return this.createSession(profile);
  }
}
