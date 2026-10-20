import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  ANONYMIZED_TARGET,
  ANONYMIZED_USER,
  PurgeService,
} from '../src/privacy/purge.service.js';
import {
  asCookieHeader,
  createTestApp,
  createUser,
  http,
  login,
  PASSWORD,
  resetDatabase,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

const DAY = 24 * 60 * 60 * 1000;

describe('Privacy / LGPD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alfa: Awaited<ReturnType<typeof signUpClinic>>;
  let admin: string;
  let master: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alfa = await signUpClinic(app, 'alfa');
    admin = asCookieHeader(alfa.cookies);
    master = asCookieHeader(await signInPlatformAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const requestDeletion = (cookie = admin, confirmationName = 'Clínica alfa') =>
    http(app)
      .post('/api/clinics/me/deletion-request')
      .set('Cookie', cookie)
      .send({ confirmationName, reason: 'Encerramos as atividades' });

  const masterPost = (path: string) =>
    http(app)
      .post(`/api/platform/clinics/${alfa.clinicId}${path}`)
      .set('Cookie', master);

  describe('export', () => {
    it('downloads every clinic record without secrets', async () => {
      const response = await http(app)
        .get('/api/clinics/me/export')
        .set('Cookie', admin)
        .expect(200);

      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename="clinica-.*\.json"/,
      );
      expect(response.body).toMatchObject({
        format: 'saas-clinicas.clinic-export.v1',
        clinic: { id: alfa.clinicId, name: 'Clínica alfa' },
        users: [{ email: 'admin@alfa.com' }],
      });
      expect(response.body.auditLogs.length).toBeGreaterThan(0);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toMatch(/passwordHash|argon2|tokenHash/);
    });

    it('is audited', async () => {
      await http(app)
        .get('/api/clinics/me/export')
        .set('Cookie', admin)
        .expect(200);

      const log = await prisma.auditLog.findFirst({
        where: { action: 'clinic.data_exported', tenantId: alfa.clinicId },
      });
      expect(log).toBeTruthy();
    });

    it('is restricted to admins and their own clinic', async () => {
      const beta = await signUpClinic(app, 'beta');
      await createUser(prisma, alfa.clinicId, {
        email: 'rec@alfa.com',
        role: 'RECEPTION',
      });
      const reception = asCookieHeader(await login(app, 'rec@alfa.com'));

      await http(app)
        .get('/api/clinics/me/export')
        .set('Cookie', reception)
        .expect(403);

      const own = await http(app)
        .get('/api/clinics/me/export')
        .set('Cookie', admin);
      expect(own.body.clinic.id).toBe(alfa.clinicId);
      expect(JSON.stringify(own.body)).not.toContain(beta.clinicId);
    });

    it('can be run by the master for any clinic', async () => {
      const response = await http(app)
        .get(`/api/platform/clinics/${alfa.clinicId}/export`)
        .set('Cookie', master)
        .expect(200);
      expect(response.body.clinic.id).toBe(alfa.clinicId);
    });
  });

  describe('deletion request (clinic admin)', () => {
    it('requires typing the exact clinic name', async () => {
      const response = await requestDeletion(admin, 'Clinica errada').expect(
        400,
      );
      expect(response.body.code).toBe('CONFIRMATION_MISMATCH');
    });

    it('creates a pending request that the admin can cancel', async () => {
      const requested = await requestDeletion().expect(200);
      expect(requested.body.deletion).toMatchObject({
        status: 'REQUESTED',
        reason: 'Encerramos as atividades',
        scheduledFor: null,
      });
      // A clínica continua funcionando até o master confirmar
      expect(requested.body.active).toBe(true);

      const again = await requestDeletion().expect(409);
      expect(again.body.code).toBe('INVALID_DELETION_STATE');

      const cancelled = await http(app)
        .delete('/api/clinics/me/deletion-request')
        .set('Cookie', admin)
        .expect(200);
      expect(cancelled.body.deletion.status).toBe('NONE');
    });

    it('keeps free-text reasons out of the audit log', async () => {
      await requestDeletion().expect(200);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.deletion_requested' },
      });
      expect(log.metadata).toEqual({ hasReason: true });
    });

    it('is not available to non-admins', async () => {
      await createUser(prisma, alfa.clinicId, {
        email: 'rec@alfa.com',
        role: 'RECEPTION',
      });
      const reception = asCookieHeader(await login(app, 'rec@alfa.com'));

      await requestDeletion(reception).expect(403);
    });
  });

  describe('master decision', () => {
    it('cannot confirm without a request', async () => {
      const response = await masterPost('/deletion/confirm').expect(409);
      expect(response.body.code).toBe('INVALID_DELETION_STATE');
    });

    it('confirming schedules the deletion in 30 days and makes the clinic read-only', async () => {
      await createUser(prisma, alfa.clinicId, {
        email: 'rec@alfa.com',
        role: 'RECEPTION',
      });
      await requestDeletion().expect(200);

      const confirmed = await masterPost('/deletion/confirm').expect(200);
      expect(confirmed.body.active).toBe(true);
      expect(confirmed.body.deletion.status).toBe('SCHEDULED');
      const days =
        (new Date(confirmed.body.deletion.scheduledFor).getTime() -
          Date.now()) /
        DAY;
      expect(days).toBeCloseTo(30, 0);

      // A sessão aberta continua e a equipe ainda entra, para consultar
      await http(app).get('/api/auth/me').set('Cookie', admin).expect(200);
      const reception = asCookieHeader(await login(app, 'rec@alfa.com'));
      await http(app).get('/api/users').set('Cookie', reception).expect(200);
      await http(app)
        .get('/api/clinics/me')
        .set('Cookie', reception)
        .expect(200);
      await http(app)
        .get('/api/clinics/me/export')
        .set('Cookie', admin)
        .expect(200);

      // Mas nenhuma escrita passa
      const blocked = await http(app)
        .post('/api/users')
        .set('Cookie', admin)
        .send({
          name: 'Novo',
          email: 'novo@alfa.com',
          role: 'RECEPTION',
          temporaryPassword: 'provisoria-1',
        })
        .expect(403);
      expect(blocked.body.code).toBe('CLINIC_READ_ONLY');
      await http(app)
        .patch(`/api/users/${alfa.adminId}/status`)
        .set('Cookie', admin)
        .send({ active: false })
        .expect(403);

      // Trocar a própria senha continua permitido
      await http(app)
        .post('/api/auth/change-password')
        .set('Cookie', reception)
        .send({ currentPassword: PASSWORD, newPassword: 'nova-senha-123' })
        .expect(200);

      await masterPost('/deletion/reject').expect(409);
    });

    it('the clinic admin can cancel during the grace period', async () => {
      await createUser(prisma, alfa.clinicId, {
        email: 'rec@alfa.com',
        role: 'RECEPTION',
      });
      await requestDeletion().expect(200);
      await masterPost('/deletion/confirm').expect(200);

      const reception = asCookieHeader(await login(app, 'rec@alfa.com'));
      await http(app)
        .delete('/api/clinics/me/deletion-request')
        .set('Cookie', reception)
        .expect(403);

      const cancelled = await http(app)
        .delete('/api/clinics/me/deletion-request')
        .set('Cookie', admin)
        .expect(200);
      expect(cancelled.body.deletion.status).toBe('NONE');

      // Saiu do modo somente leitura
      await http(app)
        .patch(`/api/users/${alfa.adminId}/status`)
        .set('Cookie', admin)
        .send({ active: true })
        .expect(200);
      const log = await prisma.auditLog.findFirst({
        where: { action: 'clinic.deletion_cancelled', actorId: alfa.adminId },
      });
      expect(log).toBeTruthy();
    });

    it('the master can cancel during the grace period', async () => {
      await requestDeletion().expect(200);
      await masterPost('/deletion/confirm').expect(200);

      const cancelled = await masterPost('/deletion/cancel').expect(200);
      expect(cancelled.body).toMatchObject({
        active: true,
        deletion: { status: 'NONE' },
      });

      await login(app, alfa.adminEmail);
    });

    it('rejecting clears the request', async () => {
      await requestDeletion().expect(200);

      const rejected = await masterPost('/deletion/reject').expect(200);
      expect(rejected.body.deletion.status).toBe('NONE');
      await masterPost('/deletion/cancel').expect(409);
    });

    it('shows the deletion status in the clinic list', async () => {
      await requestDeletion().expect(200);

      const list = await http(app)
        .get('/api/platform/clinics')
        .set('Cookie', master)
        .expect(200);
      expect(list.body[0].deletion.status).toBe('REQUESTED');
    });
  });

  describe('purge', () => {
    const schedulePastDeletion = async () => {
      await requestDeletion().expect(200);
      await masterPost('/deletion/confirm').expect(200);
      await prisma.clinic.update({
        where: { id: alfa.clinicId },
        data: { deletionScheduledFor: new Date(Date.now() - DAY) },
      });
    };

    it('deletes the clinic and keeps its audit trail anonymized', async () => {
      const beta = await signUpClinic(app, 'beta');
      await schedulePastDeletion();
      const logsBefore = await prisma.auditLog.count({
        where: { tenantId: alfa.clinicId },
      });

      const purged = await app.get(PurgeService).purgeDueClinics();

      expect(purged).toEqual([alfa.clinicId]);
      expect(
        await prisma.clinic.findUnique({ where: { id: alfa.clinicId } }),
      ).toBeNull();
      expect(
        await prisma.user.count({ where: { tenantId: alfa.clinicId } }),
      ).toBe(0);

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: alfa.clinicId },
      });
      expect(logs).toHaveLength(logsBefore + 1);
      for (const log of logs) {
        expect(log.ip).toBeNull();
        expect(log.userAgent).toBeNull();
        if (log.actorType === 'USER')
          expect(log.actorLabel).toBe(ANONYMIZED_USER);
        if (log.action !== 'clinic.purged' && log.targetLabel) {
          expect(log.targetLabel).toBe(ANONYMIZED_TARGET);
        }
      }
      expect(JSON.stringify(logs)).not.toMatch(
        /admin@alfa|Admin alfa|Clínica alfa/,
      );
      expect(logs.find((log) => log.action === 'clinic.purged')).toMatchObject({
        actorType: 'SYSTEM',
      });

      // Outra clínica não é afetada
      const betaLogs = await prisma.auditLog.findMany({
        where: { tenantId: beta.clinicId },
      });
      expect(betaLogs.some((log) => log.actorLabel === 'Admin beta')).toBe(
        true,
      );
    });

    it('skips clinics still in the grace period', async () => {
      await requestDeletion().expect(200);
      await masterPost('/deletion/confirm').expect(200);

      expect(await app.get(PurgeService).purgeDueClinics()).toEqual([]);
      expect(await prisma.clinic.count()).toBe(1);
    });
  });

  describe('IP retention', () => {
    it('clears IP and user agent from old logs only', async () => {
      const old = await prisma.auditLog.create({
        data: {
          tenantId: alfa.clinicId,
          actorType: 'SYSTEM',
          actorLabel: 'Sistema',
          action: 'clinic.reactivated',
          ip: '203.0.113.7',
          userAgent: 'Old Browser',
          occurredAt: new Date(Date.now() - 200 * DAY),
        },
      });
      const recent = await prisma.auditLog.findFirstOrThrow({
        where: { tenantId: alfa.clinicId, ip: { not: null } },
        orderBy: { occurredAt: 'desc' },
      });

      await app.get(PurgeService).expireAuditIps();

      const oldAfter = await prisma.auditLog.findUniqueOrThrow({
        where: { id: old.id },
      });
      const recentAfter = await prisma.auditLog.findUniqueOrThrow({
        where: { id: recent.id },
      });
      expect(oldAfter).toMatchObject({
        ip: null,
        userAgent: null,
        action: 'clinic.reactivated',
      });
      expect(recentAfter.ip).toBe(recent.ip);
    });
  });
});
