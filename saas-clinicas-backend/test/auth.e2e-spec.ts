import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { CLINIC_SLUG_HEADER } from '../src/clinics/slug.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  cookieValue,
  createTestApp,
  PASSWORD,
  resetDatabase,
  setCookies,
  signUpClinic,
} from './utils.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await signUpClinic(app, 'sorriso');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  const login = (email = 'admin@sorriso.com', password = PASSWORD) =>
    http()
      .post('/api/auth/login')
      .set(CLINIC_SLUG_HEADER, 'sorriso')
      .send({ email, password });

  /** Envia apenas o refresh token, como o navegador faz em /api/auth. */
  const refresh = (refreshToken: string) =>
    http()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);

  describe('POST /api/auth/login', () => {
    it('signs in with valid credentials and sets session cookies', async () => {
      const response = await login(' ADMIN@sorriso.com ').expect(200);

      expect(response.body.user).toMatchObject({
        email: 'admin@sorriso.com',
        roles: ['ADMIN'],
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const cookies = setCookies(response);
      const access = cookies.find((c) => c.startsWith('access_token='));
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      expect(access).toMatch(/Path=\/;/);
      expect(access).toMatch(/HttpOnly/);
      expect(refreshCookie).toMatch(/Path=\/api\/auth/);
      expect(refreshCookie).toMatch(/HttpOnly/);
    });

    it('rejects a wrong password', async () => {
      const response = await login('admin@sorriso.com', 'senha-errada').expect(
        401,
      );
      expect(setCookies(response)).toEqual([]);
    });

    it('returns the same error for an unknown email', async () => {
      const wrongPassword = await login('admin@sorriso.com', 'x').expect(401);
      const unknownEmail = await login('ninguem@sorriso.com').expect(401);

      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('returns 400 for a malformed body', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without a session', async () => {
      await http().get('/api/auth/me').expect(401);
    });

    it('returns 401 for a tampered token', async () => {
      await http()
        .get('/api/auth/me')
        .set('Cookie', 'access_token=eyJhbGciOiJIUzI1NiJ9.e30.invalid')
        .expect(401);
    });

    it('returns the authenticated user', async () => {
      const cookies = setCookies(await login().expect(200));

      const response = await http()
        .get('/api/auth/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);

      expect(response.body).toMatchObject({
        email: 'admin@sorriso.com',
        roles: ['ADMIN'],
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const first = cookieValue(setCookies(await login()), 'refresh_token')!;

      const response = await refresh(first).expect(200);
      const second = cookieValue(setCookies(response), 'refresh_token');

      expect(second).toBeTruthy();
      expect(second).not.toBe(first);
      expect(cookieValue(setCookies(response), 'access_token')).toBeTruthy();
    });

    it('rejects a missing or unknown refresh token', async () => {
      await http().post('/api/auth/refresh').expect(401);
      await refresh('unknown-token').expect(401);
    });

    it('revokes every session when a used refresh token is replayed', async () => {
      const first = cookieValue(setCookies(await login()), 'refresh_token')!;
      const rotated = cookieValue(
        setCookies(await refresh(first).expect(200)),
        'refresh_token',
      )!;

      // Reapresentar o token antigo indica vazamento
      await refresh(first).expect(401);

      // O token novo, emitido legitimamente, também deixa de valer
      await refresh(rotated).expect(401);
    });

    it('rejects an expired refresh token', async () => {
      const token = cookieValue(setCookies(await login()), 'refresh_token')!;
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh(token).expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh token and clears the cookies', async () => {
      const token = cookieValue(setCookies(await login()), 'refresh_token')!;

      const response = await http()
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${token}`)
        .expect(204);

      const cleared = setCookies(response);
      expect(cookieValue(cleared, 'access_token')).toBe('');
      expect(cookieValue(cleared, 'refresh_token')).toBe('');

      await refresh(token).expect(401);
    });

    it('works without a session', async () => {
      await http().post('/api/auth/logout').expect(204);
    });
  });
});
