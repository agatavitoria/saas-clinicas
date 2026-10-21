import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  clinicPayload,
  cookieValue,
  createTestApp,
  http,
  login,
  MASTER_EMAIL,
  PASSWORD,
  resetDatabase,
  setCookies,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

describe('Platform admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let master: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    master = asCookieHeader(await signInPlatformAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const asMaster = {
    get: (path: string) => http(app).get(path).set('Cookie', master),
    post: (path: string, body: object) =>
      http(app).post(path).set('Cookie', master).send(body),
    patch: (path: string, body: object) =>
      http(app).patch(path).set('Cookie', master).send(body),
  };

  describe('auth', () => {
    it('signs in with platform cookies scoped to /api/platform', async () => {
      await resetDatabase(prisma);
      const cookies = await signInPlatformAdmin(app);

      const access = cookies.find((c) =>
        c.startsWith('platform_access_token='),
      );
      const refresh = cookies.find((c) =>
        c.startsWith('platform_refresh_token='),
      );
      expect(access).toMatch(/Path=\/api\/platform;/);
      expect(access).toMatch(/HttpOnly/);
      expect(refresh).toMatch(/Path=\/api\/platform\/auth/);
    });

    it('returns the authenticated admin', async () => {
      const response = await asMaster.get('/api/platform/auth/me').expect(200);
      expect(response.body).toMatchObject({ email: MASTER_EMAIL });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('accepts a plain login instead of an email (seeded "admin")', async () => {
      await prisma.platformAdmin.create({
        data: {
          name: 'Admin',
          email: 'admin',
          passwordHash: await argon2.hash('admin'),
        },
      });

      await http(app)
        .post('/api/platform/auth/login')
        .send({ email: ' ADMIN ', password: 'admin' })
        .expect(200);
    });

    it('rejects a wrong password', async () => {
      await http(app)
        .post('/api/platform/auth/login')
        .send({ email: MASTER_EMAIL, password: 'errada-123' })
        .expect(401);
    });

    it('rotates the refresh token and revokes it on logout', async () => {
      await resetDatabase(prisma);
      const first = cookieValue(
        await signInPlatformAdmin(app),
        'platform_refresh_token',
      )!;
      const refresh = (token: string) =>
        http(app)
          .post('/api/platform/auth/refresh')
          .set('Cookie', `platform_refresh_token=${token}`);

      const rotated = cookieValue(
        setCookies(await refresh(first).expect(200)),
        'platform_refresh_token',
      )!;
      expect(rotated).not.toBe(first);

      await http(app)
        .post('/api/platform/auth/logout')
        .set('Cookie', `platform_refresh_token=${rotated}`)
        .expect(204);
      await refresh(rotated).expect(401);
    });

    it('blocks an inactive admin immediately', async () => {
      await prisma.platformAdmin.updateMany({ data: { active: false } });

      await asMaster.get('/api/platform/clinics').expect(401);
      await http(app)
        .post('/api/platform/auth/login')
        .send({ email: MASTER_EMAIL, password: PASSWORD })
        .expect(401);
    });
  });

  describe('session isolation', () => {
    it('rejects a clinic session on platform routes', async () => {
      const { cookies } = await signUpClinic(app, 'alfa');

      await http(app)
        .get('/api/platform/clinics')
        .set('Cookie', asCookieHeader(cookies))
        .expect(401);
    });

    it('rejects a platform session on clinic routes', async () => {
      await http(app).get('/api/users').set('Cookie', master).expect(401);
      await http(app).get('/api/auth/me').set('Cookie', master).expect(401);
    });

    it('rejects a clinic token placed in the platform cookie', async () => {
      const { cookies } = await signUpClinic(app, 'alfa');
      const tenantToken = cookieValue(cookies, 'access_token')!;

      await http(app)
        .get('/api/platform/clinics')
        .set('Cookie', `platform_access_token=${tenantToken}`)
        .expect(401);
    });
  });

  describe('clinics', () => {
    it('creates a clinic whose admin must change the temporary password', async () => {
      const response = await asMaster
        .post('/api/platform/clinics', clinicPayload('sorriso'))
        .expect(201);

      expect(response.body.clinic).toMatchObject({
        name: 'Clínica sorriso',
        phone: '1133334444',
        document: '11222333000181',
        active: true,
      });
      expect(response.body.admin).toMatchObject({
        tenantId: response.body.clinic.id,
        email: 'admin@sorriso.com',
        roles: ['ADMIN'],
        mustChangePassword: true,
      });
      expect(response.body.admin).not.toHaveProperty('passwordHash');
      // Criar uma clínica não abre sessão de clínica para o master
      expect(cookieValue(setCookies(response), 'access_token')).toBeUndefined();
    });

    it('validates the payload', async () => {
      const body = clinicPayload('sorriso');
      body.businessHours[0].closesAt = '07:00';
      await asMaster.post('/api/platform/clinics', body).expect(400);

      await asMaster
        .post('/api/platform/clinics', {
          ...clinicPayload('sorriso'),
          tenantId: 'x',
        })
        .expect(400);
      expect(await prisma.clinic.count()).toBe(0);
    });

    it('returns 409 for a duplicated admin email and keeps no partial data', async () => {
      await asMaster
        .post('/api/platform/clinics', clinicPayload('sorriso'))
        .expect(201);

      const duplicate = clinicPayload('outra');
      duplicate.admin.email = 'ADMIN@sorriso.com';
      const response = await asMaster
        .post('/api/platform/clinics', duplicate)
        .expect(409);

      expect(response.body.code).toBe('EMAIL_IN_USE');
      expect(await prisma.clinic.count()).toBe(1);
    });

    it('lists every clinic with its users count', async () => {
      await signUpClinic(app, 'alfa');
      await signUpClinic(app, 'beta');

      const response = await asMaster.get('/api/platform/clinics').expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({
          name: 'Clínica alfa',
          usersCount: 1,
          active: true,
        }),
        expect.objectContaining({
          name: 'Clínica beta',
          usersCount: 1,
          active: true,
        }),
      ]);
    });

    it('returns 404 for an unknown clinic and 400 for an invalid id', async () => {
      await asMaster
        .get('/api/platform/clinics/00000000-0000-4000-8000-000000000000')
        .expect(404);
      await asMaster.get('/api/platform/clinics/not-a-uuid').expect(400);
    });

    it('deactivating a clinic blocks its users and ends their sessions', async () => {
      const { clinicId, adminEmail, cookies } = await signUpClinic(app, 'alfa');

      await asMaster
        .patch(`/api/platform/clinics/${clinicId}/status`, { active: false })
        .expect(200);

      // Sessão aberta cai na hora
      await http(app)
        .get('/api/auth/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(401);
      await http(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${cookieValue(cookies, 'refresh_token')}`)
        .expect(401);

      const loginResponse = await http(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: PASSWORD })
        .expect(403);
      expect(loginResponse.body.code).toBe('CLINIC_INACTIVE');

      await asMaster
        .patch(`/api/platform/clinics/${clinicId}/status`, { active: true })
        .expect(200);
      await login(app, adminEmail);
    });
  });

  describe('clinic users', () => {
    it('manages the users of any clinic', async () => {
      const { clinicId } = await signUpClinic(app, 'alfa');
      const base = `/api/platform/clinics/${clinicId}/users`;

      const created = await asMaster
        .post(base, {
          name: 'Dra. Carla',
          email: 'carla@alfa.com',
          roles: ['PROFESSIONAL'],
          temporaryPassword: 'provisoria-1',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        roles: ['PROFESSIONAL'],
        active: true,
        mustChangePassword: true,
      });

      const list = await asMaster.get(base).expect(200);
      expect(list.body.map((u: { email: string }) => u.email)).toEqual([
        'admin@alfa.com',
        'carla@alfa.com',
      ]);

      await asMaster
        .patch(`${base}/${created.body.id}/status`, { active: false })
        .expect(200);
      await asMaster
        .post(`${base}/${created.body.id}/reset-password`, {
          temporaryPassword: 'provisoria-2',
        })
        .expect(200);
    });

    it('cannot reach a user through another clinic', async () => {
      const alfa = await signUpClinic(app, 'alfa');
      const beta = await signUpClinic(app, 'beta');

      await asMaster
        .patch(
          `/api/platform/clinics/${alfa.clinicId}/users/${beta.adminId}/status`,
          {
            active: false,
          },
        )
        .expect(404);
    });

    it('returns 404 for users of an unknown clinic', async () => {
      await asMaster
        .get('/api/platform/clinics/00000000-0000-4000-8000-000000000000/users')
        .expect(404);
    });

    it('keeps at least one active admin per clinic', async () => {
      const { clinicId, adminId } = await signUpClinic(app, 'alfa');

      const response = await asMaster
        .patch(`/api/platform/clinics/${clinicId}/users/${adminId}/status`, {
          active: false,
        })
        .expect(409);
      expect(response.body.code).toBe('LAST_ACTIVE_ADMIN');
    });
  });
});
