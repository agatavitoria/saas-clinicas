import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type AccessTokenPayload,
  USER_PROFILE_SELECT,
  type UserProfile,
} from './auth-user.js';

export interface Session {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  /**
   * Hash verificado quando o e-mail não existe, para que a resposta leve o
   * mesmo tempo e não revele quais e-mails estão cadastrados.
   */
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async login(email: string, password: string): Promise<Session> {
    // O login é a única busca de usuário sem tenant: o e-mail é único na
    // plataforma e é ele que identifica a clínica.
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_PROFILE_SELECT, passwordHash: true },
    });

    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _, ...profile } = user;
    return this.createSession(profile);
  }

  /** Emite access token e um novo refresh token persistido. */
  async createSession(user: UserProfile): Promise<Session> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenExpiresAt = new Date(
      Date.now() +
        this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_IN_MS,
    );

    await this.prisma.forTenant(user.tenantId).refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return { user, accessToken, refreshToken, refreshTokenExpiresAt };
  }

  /**
   * Troca um refresh token válido por uma nova sessão (rotação). Se um token
   * já revogado for reapresentado, assume vazamento e revoga todas as
   * sessões do usuário.
   */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw new UnauthorizedException();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: USER_PROFILE_SELECT } },
    });
    if (!stored) throw new UnauthorizedException();

    const tenantDb = this.prisma.forTenant(stored.tenantId);

    if (stored.revokedAt) {
      await tenantDb.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }

    if (stored.expiresAt <= new Date()) throw new UnauthorizedException();

    // Revoga de forma condicional: em requisições simultâneas com o mesmo
    // token, só uma consegue a rotação.
    const { count } = await tenantDb.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException();

    return this.createSession(stored.user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string, tenantId: string): Promise<UserProfile> {
    const user = await this.prisma
      .forTenant(tenantId)
      .user.findUnique({ where: { id: userId }, select: USER_PROFILE_SELECT });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
