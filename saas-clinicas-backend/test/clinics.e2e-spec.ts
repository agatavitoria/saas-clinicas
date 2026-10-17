import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  clinicPayload,
  cookieValue,
  createTestApp,
  resetDatabase,
  setCookies,
} from './utils.js';

describe('Clinics (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/clinics')
      .send(body as object);

  describe('POST /api/clinics', () => {
    it('creates a clinic with its business hours and admin user', async () => {
      const response = await post(clinicPayload('sorriso')).expect(201);

      expect(response.body.clinic).toMatchObject({
        name: 'Clínica sorriso',
        email: 'contato@sorriso.com',
        phone: '1133334444',
        document: '11222333000181',
        businessHours: [
          { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
          { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
        ],
      });
      expect(response.body.admin).toMatchObject({
        tenantId: response.body.clinic.id,
        email: 'admin@sorriso.com',
        role: 'ADMIN',
      });
    });

    it('signs the admin in with httpOnly session cookies', async () => {
      const response = await post(clinicPayload('sorriso')).expect(201);
      const cookies = setCookies(response);

      expect(cookieValue(cookies, 'access_token')).toBeTruthy();
      expect(cookieValue(cookies, 'refresh_token')).toBeTruthy();
      for (const cookie of cookies) {
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Lax/i);
      }

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);
    });

    it('never exposes the password or its hash', async () => {
      const response = await post(clinicPayload('sorriso')).expect(201);

      expect(response.body.admin).not.toHaveProperty('passwordHash');
      expect(response.body.admin).not.toHaveProperty('password');

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'admin@sorriso.com' },
      });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('returns 400 for an invalid payload', async () => {
      const body = clinicPayload('sorriso');
      body.businessHours[0].closesAt = '07:00';

      await post(body).expect(400);
      expect(await prisma.clinic.count()).toBe(0);
    });

    it('returns 400 for unknown properties (e.g. a client-sent tenantId)', async () => {
      await post({ ...clinicPayload('sorriso'), tenantId: 'other' }).expect(
        400,
      );
    });

    it('returns 409 when the admin email is already in use and keeps no partial data', async () => {
      await post(clinicPayload('sorriso')).expect(201);

      const duplicate = clinicPayload('outra');
      duplicate.admin.email = 'ADMIN@sorriso.com';
      await post(duplicate).expect(409);

      expect(await prisma.clinic.count()).toBe(1);
    });
  });

  describe('GET /api/clinics/me', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/clinics/me').expect(401);
    });

    it("returns the authenticated user's clinic", async () => {
      const created = await post(clinicPayload('sorriso')).expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/clinics/me')
        .set('Cookie', asCookieHeader(setCookies(created)))
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.body.clinic.id,
        name: 'Clínica sorriso',
        businessHours: [{ weekday: 1 }, { weekday: 3 }],
      });
    });
  });
});
