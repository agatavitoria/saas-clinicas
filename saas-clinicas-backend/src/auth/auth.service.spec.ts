import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const profile = {
  id: 'user-1',
  tenantId: 'clinic-1',
  name: 'Ana Souza',
  email: 'ana@sorriso.com',
  role: 'ADMIN' as const,
};

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-jwt') };
  const tenantDb = {
    refreshToken: { create: vi.fn(), updateMany: vi.fn() },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    refreshToken: { findUnique: vi.fn(), updateMany: vi.fn() },
    forTenant: vi.fn(() => tenantDb),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(7) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('creates a session for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...profile,
        passwordHash: await argon2.hash('senha-segura'),
      });

      const session = await service.login('ana@sorriso.com', 'senha-segura');

      expect(session.user).toEqual(profile);
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(session.accessToken).toBe('signed-jwt');
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        tenantId: 'clinic-1',
        role: 'ADMIN',
      });
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...profile,
        passwordHash: await argon2.hash('senha-segura'),
      });

      await expect(
        service.login('ana@sorriso.com', 'outra-senha'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tenantDb.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('ninguem@sorriso.com', 'senha-segura'),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('createSession', () => {
    it('persists only the hash of the refresh token, scoped to the tenant', async () => {
      const session = await service.createSession(profile);

      expect(prisma.forTenant).toHaveBeenCalledWith('clinic-1');
      const { data } = tenantDb.refreshToken.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(sha256(session.refreshToken));
      expect(data.tokenHash).not.toBe(session.refreshToken);
      expect(data.userId).toBe('user-1');
    });

    it('sets the refresh token expiration from the config', async () => {
      const before = Date.now();
      const session = await service.createSession(profile);

      const days =
        (session.refreshTokenExpiresAt.getTime() - before) / 86_400_000;
      expect(days).toBeCloseTo(7, 2);
    });
  });

  describe('refresh', () => {
    const stored = (overrides: object = {}) => ({
      id: 'token-1',
      tenantId: 'clinic-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: profile,
      ...overrides,
    });

    it('revokes the used token and issues a new session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      tenantDb.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const session = await service.refresh('raw-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: sha256('raw-token') } }),
      );
      expect(tenantDb.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-1', revokedAt: null } }),
      );
      expect(session.user).toEqual(profile);
    });

    it('revokes all user sessions when a revoked token is reused', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        stored({ revokedAt: new Date() }),
      );

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tenantDb.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
      expect(tenantDb.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        stored({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when a concurrent request already rotated the token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      tenantDb.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tenantDb.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a missing or unknown token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
