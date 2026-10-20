import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  cookieValue,
  createTestApp,
  createUser,
  http,
  login,
  resetDatabase,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

interface Entry {
  id: string;
  action: string;
  tenantId: string | null;
  clinicName?: string | null;
  actor: { type: string; id: string | null; label: string };
  target: { type: string; id: string | null; label: string | null } | null;
  metadata: Record<string, unknown>;
  ip: string | null;
}

describe('Audit log (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alfa: Awaited<ReturnType<typeof signUpClinic>>;
  let beta: Awaited<ReturnType<typeof signUpClinic>>;
  let master: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alfa = await signUpClinic(app, 'alfa');
    beta = await signUpClinic(app, 'beta');
    master = asCookieHeader(await signInPlatformAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, cookie: string) =>
    http(app).get(path).set('Cookie', cookie);

  const entries = async (path: string, cookie: string): Promise<Entry[]> =>
    (await get(path, cookie).expect(200)).body.items as Entry[];

  const deactivate = (cookie: string, userId: string, active = false) =>
    http(app)
      .patch(`/api/users/${userId}/status`)
      .set('Cookie', cookie)
      .send({ active });

  describe('recording', () => {
    it('records who did what to whom, with the request context', async () => {
      const pro = await createUser(prisma, alfa.clinicId, {
        email: 'pro@alfa.com',
        role: 'PROFESSIONAL',
        name: 'Paula Pro',
      });

      await deactivate(asCookieHeader(alfa.cookies), pro.id).expect(200);

      const [last] = await entries(
        '/api/audit-logs',
        asCookieHeader(alfa.cookies),
      );
      expect(last).toMatchObject({
        action: 'user.deactivated',
        tenantId: alfa.clinicId,
        actor: { type: 'USER', id: alfa.adminId, label: 'Admin alfa' },
        target: { type: 'User', id: pro.id, label: 'Paula Pro' },
        metadata: { active: { from: true, to: false } },
      });
      expect(last.ip).toBeTruthy();
    });

    it('records nothing when the action fails', async () => {
      // Master tentando desativar o único admin: 409 LAST_ACTIVE_ADMIN
      await http(app)
        .patch(
          `/api/platform/clinics/${alfa.clinicId}/users/${alfa.adminId}/status`,
        )
        .set('Cookie', master)
        .send({ active: false })
        .expect(409);

      const logs = await prisma.auditLog.findMany({
        where: { action: 'user.deactivated' },
      });
      expect(logs).toHaveLength(0);
    });

    it("attributes the master's actions to the affected clinic", async () => {
      const pro = await createUser(prisma, alfa.clinicId, {
        email: 'pro@alfa.com',
        role: 'PROFESSIONAL',
      });

      await http(app)
        .patch(`/api/platform/clinics/${alfa.clinicId}/users/${pro.id}/status`)
        .set('Cookie', master)
        .send({ active: false })
        .expect(200);

      const [last] = await entries(
        '/api/audit-logs',
        asCookieHeader(alfa.cookies),
      );
      expect(last).toMatchObject({
        action: 'user.deactivated',
        tenantId: alfa.clinicId,
        actor: { type: 'PLATFORM_ADMIN', label: 'Master' },
      });
    });

    it('records logout and session reuse', async () => {
      const refresh = cookieValue(alfa.cookies, 'refresh_token')!;
      const rotated = await http(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refresh}`)
        .expect(200);
      // Reapresentar o token antigo = reuso
      await http(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refresh}`)
        .expect(401);

      const session = asCookieHeader(await login(app, alfa.adminEmail));
      await http(app)
        .post('/api/auth/logout')
        .set('Cookie', session)
        .expect(204);
      expect(rotated.status).toBe(200);

      const actions = (
        await prisma.auditLog.findMany({ where: { tenantId: alfa.clinicId } })
      ).map((log) => log.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'auth.session_reuse_detected',
          'auth.logged_out',
        ]),
      );
    });

    it('is append-only at the database level', async () => {
      await expect(
        prisma.$executeRaw`UPDATE audit_logs SET action = 'tampered'`,
      ).rejects.toThrow(/append-only/);
      await expect(prisma.auditLog.deleteMany()).rejects.toThrow(/append-only/);
    });
  });

  describe('visibility', () => {
    it('shows the admin only their own clinic', async () => {
      const logs = await entries(
        '/api/audit-logs',
        asCookieHeader(alfa.cookies),
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((log) => log.tenantId === alfa.clinicId)).toBe(true);
    });

    it('hides the log from non-admin users', async () => {
      await createUser(prisma, alfa.clinicId, {
        email: 'rec@alfa.com',
        role: 'RECEPTION',
      });
      const reception = asCookieHeader(await login(app, 'rec@alfa.com'));

      await get('/api/audit-logs', reception).expect(403);
    });

    it('shows the master everything, with clinic names', async () => {
      const logs = await entries('/api/platform/audit-logs', master);

      const tenants = new Set(logs.map((log) => log.tenantId));
      expect(tenants).toEqual(new Set([alfa.clinicId, beta.clinicId, null]));
      expect(
        logs.find((log) => log.action === 'platform.logged_in'),
      ).toBeTruthy();
      expect(
        logs.find((log) => log.tenantId === beta.clinicId)?.clinicName,
      ).toBe('Clínica beta');
    });

    it('lets the master filter by clinic', async () => {
      const byQuery = await entries(
        `/api/platform/audit-logs?tenantId=${beta.clinicId}`,
        master,
      );
      const byClinic = await entries(
        `/api/platform/clinics/${beta.clinicId}/audit-logs`,
        master,
      );

      expect(byQuery.every((log) => log.tenantId === beta.clinicId)).toBe(true);
      expect(byClinic.map((log) => log.id)).toEqual(
        byQuery.map((log) => log.id),
      );
    });

    it('rejects a clinic session on the platform log', async () => {
      await get(
        '/api/platform/audit-logs',
        asCookieHeader(alfa.cookies),
      ).expect(401);
    });
  });

  describe('listing', () => {
    it('paginates with a cursor without repeating or skipping', async () => {
      const pro = await createUser(prisma, alfa.clinicId, {
        email: 'pro@alfa.com',
        role: 'PROFESSIONAL',
      });
      const admin = asCookieHeader(alfa.cookies);
      for (let i = 0; i < 3; i++) {
        await deactivate(admin, pro.id, false).expect(200);
        await deactivate(admin, pro.id, true).expect(200);
      }

      const all = await entries('/api/audit-logs?limit=100', admin);
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query: string = cursor ? `&cursor=${cursor}` : '';
        const response = await get(
          `/api/audit-logs?limit=2${query}`,
          admin,
        ).expect(200);
        seen.push(...response.body.items.map((item: Entry) => item.id));
        cursor = response.body.nextCursor;
      } while (cursor);

      expect(seen).toEqual(all.map((log) => log.id));
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('filters by action', async () => {
      const logs = await entries(
        '/api/audit-logs?action=auth.logged_in',
        asCookieHeader(alfa.cookies),
      );
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((log) => log.action === 'auth.logged_in')).toBe(true);
    });

    it('validates the filters', async () => {
      const admin = asCookieHeader(alfa.cookies);
      await get('/api/audit-logs?action=user.hacked', admin).expect(400);
      await get('/api/audit-logs?cursor=@@invalid@@', admin).expect(400);
      await get('/api/audit-logs?limit=1000', admin).expect(400);
    });
  });
});
