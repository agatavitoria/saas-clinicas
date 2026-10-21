import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  createTestApp,
  resetDatabase,
  signUpClinic,
} from './utils.js';

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clinicA: Awaited<ReturnType<typeof signUpClinic>>;
  let clinicB: Awaited<ReturnType<typeof signUpClinic>>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    clinicA = await signUpClinic(app, 'alfa');
    clinicB = await signUpClinic(app, 'beta');

    // Mais um membro na clínica B, para garantir que a lista não vaza
    await prisma.user.create({
      data: {
        tenantId: clinicB.clinicId,
        name: 'Recepção Beta',
        email: 'recepcao@beta.com',
        passwordHash: 'irrelevant',
        roles: ['RECEPTION'],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, cookies: string[]) =>
    request(app.getHttpServer())
      .get(path)
      .set('Cookie', asCookieHeader(cookies));

  describe('HTTP', () => {
    it('GET /api/clinics/me returns only the own clinic', async () => {
      const a = await get('/api/clinics/me', clinicA.cookies).expect(200);
      const b = await get('/api/clinics/me', clinicB.cookies).expect(200);

      expect(a.body.id).toBe(clinicA.clinicId);
      expect(b.body.id).toBe(clinicB.clinicId);
    });

    it('GET /api/users lists only the own team', async () => {
      const a = await get('/api/users', clinicA.cookies).expect(200);
      const b = await get('/api/users', clinicB.cookies).expect(200);

      expect(a.body.map((u: { email: string }) => u.email)).toEqual([
        'admin@alfa.com',
      ]);
      expect(b.body.map((u: { email: string }) => u.email).sort()).toEqual([
        'admin@beta.com',
        'recepcao@beta.com',
      ]);
    });

    it('GET /api/users never exposes password hashes', async () => {
      const response = await get('/api/users', clinicB.cookies).expect(200);

      for (const user of response.body) {
        expect(user).not.toHaveProperty('passwordHash');
      }
    });

    it('ignores a tenantId sent by the client', async () => {
      const response = await get(
        `/api/users?tenantId=${clinicB.clinicId}`,
        clinicA.cookies,
      ).expect(200);

      expect(response.body.map((u: { email: string }) => u.email)).toEqual([
        'admin@alfa.com',
      ]);
    });
  });

  describe('prisma.forTenant', () => {
    it('scopes reads to the tenant', async () => {
      const db = prisma.forTenant(clinicA.clinicId);

      expect(await db.clinic.findMany()).toHaveLength(1);
      expect(await db.user.count()).toBe(1);
      expect(
        await db.user.findFirst({ where: { email: 'admin@beta.com' } }),
      ).toBeNull();
      expect(
        await db.user.findUnique({ where: { id: clinicB.adminId } }),
      ).toBeNull();
    });

    it('scopes bulk writes to the tenant', async () => {
      const { count } = await prisma
        .forTenant(clinicA.clinicId)
        .user.updateMany({ data: { name: 'Alterado' } });

      expect(count).toBe(1);
      const untouched = await prisma.user.findUniqueOrThrow({
        where: { id: clinicB.adminId },
      });
      expect(untouched.name).toBe('Admin beta');
    });

    it('refuses single-record writes on another tenant', async () => {
      await expect(
        prisma
          .forTenant(clinicA.clinicId)
          .user.update({ where: { id: clinicB.adminId }, data: { name: 'x' } }),
      ).rejects.toThrow();
    });

    it('forces the tenantId on create', async () => {
      const created = await prisma.forTenant(clinicA.clinicId).user.create({
        data: {
          tenantId: clinicB.clinicId,
          name: 'Intruso',
          email: 'intruso@alfa.com',
          passwordHash: 'irrelevant',
          roles: ['PROFESSIONAL'],
        },
      });

      expect(created.tenantId).toBe(clinicA.clinicId);
    });
  });
});
