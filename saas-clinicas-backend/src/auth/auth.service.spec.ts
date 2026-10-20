import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const profile = {
  id: 'user-1',
  tenantId: 'clinic-1',
  name: 'Ana Souza',
  email: 'ana@sorriso.com',
  role: 'ADMIN' as const,
  mustChangePassword: false,
};

/** Código do corpo de uma HttpException (ex.: USER_INACTIVE). */
async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return (error.getResponse() as { code?: string }).code;
    }
    throw error;
  }
  throw new Error('Expected the promise to reject');
}

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-jwt') };
  const tenantDb = {
    refreshToken: { create: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    refreshToken: { findUnique: vi.fn(), updateMany: vi.fn() },
    forTenant: vi.fn(() => tenantDb),
  };

  const storedUser = (overrides: object = {}) => ({
    ...profile,
    passwordHash,
    active: true,
    clinic: { active: true },
    ...overrides,
  });

  beforeAll(async () => {
    passwordHash = await argon2.hash('senha-segura');
  });

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
      prisma.user.findUnique.mockResolvedValue(storedUser());

      const session = await service.login('ana@sorriso.com', 'senha-segura');

      expect(session.user).toEqual(profile);
      expect(session.accessToken).toBe('signed-jwt');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', tenantId: 'clinic-1', role: 'ADMIN' },
        { audience: 'tenant' },
      );
      expect(prisma.forTenant).toHaveBeenCalledWith('clinic-1');
      expect(tenantDb.refreshToken.create).toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser());

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

    it('reports an inactive user only after a correct password', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser({ active: false }));

      expect(
        await errorCode(service.login('ana@sorriso.com', 'senha-segura')),
      ).toBe('USER_INACTIVE');
      await expect(
        service.login('ana@sorriso.com', 'errada-123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reports an inactive clinic', async () => {
      prisma.user.findUnique.mockResolvedValue(
        storedUser({ clinic: { active: false } }),
      );

      expect(
        await errorCode(service.login('ana@sorriso.com', 'senha-segura')),
      ).toBe('CLINIC_INACTIVE');
    });
  });

  describe('changePassword', () => {
    const auth = {
      userId: 'user-1',
      tenantId: 'clinic-1',
      role: 'ADMIN' as const,
    };

    beforeEach(() => {
      tenantDb.user.findUnique.mockResolvedValue({ passwordHash });
      tenantDb.user.update.mockResolvedValue(profile);
    });

    it('stores the new hash, clears the flag and revokes other sessions', async () => {
      const session = await service.changePassword(
        auth,
        'senha-segura',
        'nova-senha-123',
      );

      const { data } = tenantDb.user.update.mock.calls[0][0];
      expect(data.mustChangePassword).toBe(false);
      expect(await argon2.verify(data.passwordHash, 'nova-senha-123')).toBe(
        true,
      );
      expect(tenantDb.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
      expect(session.user).toEqual(profile);
    });

    it('rejects a wrong current password', async () => {
      expect(
        await errorCode(
          service.changePassword(auth, 'errada-123', 'nova-senha-123'),
        ),
      ).toBe('INVALID_CURRENT_PASSWORD');
      expect(tenantDb.user.update).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      expect(
        await errorCode(
          service.changePassword(auth, 'senha-segura', 'senha-segura'),
        ),
      ).toBe('SAME_PASSWORD');
    });
  });
});
