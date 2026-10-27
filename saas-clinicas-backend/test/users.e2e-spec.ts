import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  createTestApp,
  createUser,
  http,
  login,
  PASSWORD,
  resetDatabase,
  signUpClinic,
  postLogin,
} from './utils.js';

describe('Team management by the clinic admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clinic: Awaited<ReturnType<typeof signUpClinic>>;
  let admin: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    clinic = await signUpClinic(app, 'alfa');
    admin = asCookieHeader(clinic.cookies);
  });

  afterAll(async () => {
    await app.close();
  });

  const newUser = {
    name: 'Rita Recepção',
    email: 'rita@alfa.com',
    roles: ['RECEPTION'],
    temporaryPassword: 'provisoria-1',
  };

  const as = (cookie: string) => ({
    get: (path: string) => http(app).get(path).set('Cookie', cookie),
    post: (path: string, body: object) =>
      http(app).post(path).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) =>
      http(app).patch(path).set('Cookie', cookie).send(body),
  });

  describe('POST /api/users', () => {
    it('creates a user that must change the temporary password', async () => {
      const response = await as(admin).post('/api/users', newUser).expect(201);

      expect(response.body).toMatchObject({
        email: 'rita@alfa.com',
        roles: ['RECEPTION'],
        active: true,
        mustChangePassword: true,
      });
      expect(response.body).not.toHaveProperty('passwordHash');

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'rita@alfa.com' },
      });
      expect(stored.tenantId).toBe(clinic.clinicId);
    });

    it('returns 409 for an email already in use (in any clinic)', async () => {
      await signUpClinic(app, 'beta');

      const response = await as(admin)
        .post('/api/users', { ...newUser, email: 'admin@beta.com' })
        .expect(409);
      expect(response.body.code).toBe('EMAIL_IN_USE');
    });

    it('validates the payload', async () => {
      await as(admin)
        .post('/api/users', { ...newUser, roles: ['SUPERUSER'] })
        .expect(400);
      await as(admin)
        .post('/api/users', { ...newUser, temporaryPassword: '123' })
        .expect(400);
      await as(admin)
        .post('/api/users', { ...newUser, tenantId: 'other' })
        .expect(400);
    });
  });

  describe('roles', () => {
    it('lets non-admins see the team but not manage it', async () => {
      await createUser(prisma, clinic.clinicId, {
        email: 'pro@alfa.com',
        roles: ['PROFESSIONAL'],
      });
      const pro = asCookieHeader(await login(app, 'pro@alfa.com'));

      await as(pro).get('/api/users').expect(200);
      await as(pro).post('/api/users', newUser).expect(403);
      await as(pro)
        .patch(`/api/users/${clinic.adminId}/status`, { active: false })
        .expect(403);
      await as(pro)
        .post(`/api/users/${clinic.adminId}/reset-password`, {
          temporaryPassword: 'provisoria-1',
        })
        .expect(403);
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    it('deactivating ends the open session immediately and blocks login', async () => {
      const user = await createUser(prisma, clinic.clinicId, {
        email: 'pro@alfa.com',
        roles: ['PROFESSIONAL'],
      });
      const session = await login(app, 'pro@alfa.com');

      const response = await as(admin)
        .patch(`/api/users/${user.id}/status`, { active: false })
        .expect(200);
      expect(response.body.active).toBe(false);

      // O access token ainda não expirou, mas a sessão já não vale
      await as(asCookieHeader(session)).get('/api/auth/me').expect(401);

      const loginResponse = await postLogin(app, {
        email: 'pro@alfa.com',
        password: PASSWORD,
      }).expect(403);
      expect(loginResponse.body.code).toBe('USER_INACTIVE');
    });

    it('reactivating allows login again', async () => {
      const user = await createUser(prisma, clinic.clinicId, {
        email: 'pro@alfa.com',
        roles: ['PROFESSIONAL'],
      });
      await as(admin)
        .patch(`/api/users/${user.id}/status`, { active: false })
        .expect(200);
      await as(admin)
        .patch(`/api/users/${user.id}/status`, { active: true })
        .expect(200);

      await login(app, 'pro@alfa.com');
    });

    it('does not let the admin deactivate themselves', async () => {
      await createUser(prisma, clinic.clinicId, {
        email: 'outro-admin@alfa.com',
        roles: ['ADMIN'],
      });

      const response = await as(admin)
        .patch(`/api/users/${clinic.adminId}/status`, { active: false })
        .expect(409);
      expect(response.body.code).toBe('CANNOT_DEACTIVATE_SELF');
    });

    it('lets an admin deactivate another admin', async () => {
      // O caso "último admin ativo" só é alcançável pelo master (testado lá):
      // aqui quem age é sempre um admin ativo e não pode inativar a si mesmo
      const second = await createUser(prisma, clinic.clinicId, {
        email: 'outro-admin@alfa.com',
        roles: ['ADMIN'],
      });

      const response = await as(admin)
        .patch(`/api/users/${second.id}/status`, { active: false })
        .expect(200);
      expect(response.body.active).toBe(false);
    });

    it('returns 404 for a user of another clinic', async () => {
      const beta = await signUpClinic(app, 'beta');

      await as(admin)
        .patch(`/api/users/${beta.adminId}/status`, { active: false })
        .expect(404);
      await as(admin)
        .post(`/api/users/${beta.adminId}/reset-password`, {
          temporaryPassword: 'provisoria-1',
        })
        .expect(404);

      const untouched = await prisma.user.findUniqueOrThrow({
        where: { id: beta.adminId },
      });
      expect(untouched.active).toBe(true);
    });

    it('returns 400 for an invalid id', async () => {
      await as(admin)
        .patch('/api/users/not-a-uuid/status', { active: false })
        .expect(400);
    });
  });

  describe('POST /api/users/:id/reset-password', () => {
    it('sets a new temporary password and ends the open sessions', async () => {
      const user = await createUser(prisma, clinic.clinicId, {
        email: 'pro@alfa.com',
        roles: ['PROFESSIONAL'],
      });
      const session = asCookieHeader(await login(app, 'pro@alfa.com'));

      await as(admin)
        .post(`/api/users/${user.id}/reset-password`, {
          temporaryPassword: 'provisoria-nova',
        })
        .expect(200);

      // A sessão aberta agora exige troca de senha
      const blocked = await as(session).get('/api/users').expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

      await postLogin(app, {
        email: 'pro@alfa.com',
        password: PASSWORD,
      }).expect(401);
      const relogin = await postLogin(app, {
        email: 'pro@alfa.com',
        password: 'provisoria-nova',
      }).expect(200);
      expect(relogin.body.user.mustChangePassword).toBe(true);
    });
  });
});
