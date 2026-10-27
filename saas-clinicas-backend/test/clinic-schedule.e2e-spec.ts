import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  createUser,
  http,
  login,
  resetDatabase,
  createTestApp,
  signUpClinic,
} from './utils.js';

describe('Clinic schedule settings (e2e)', () => {
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

  const patchSettings = (cookies: string[], body: object) =>
    http(app)
      .patch('/api/clinics/me/schedule-settings')
      .set('Cookie', asCookieHeader(cookies))
      .send(body);

  const putHours = (cookies: string[], businessHours: object[]) =>
    http(app)
      .put('/api/clinics/me/business-hours')
      .set('Cookie', asCookieHeader(cookies))
      .send({ businessHours });

  describe('time zone and default duration', () => {
    it('start with the defaults', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const { body } = await http(app)
        .get('/api/clinics/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);
      expect(body).toMatchObject({
        timeZone: 'America/Sao_Paulo',
        defaultAppointmentMinutes: 30,
      });
    });

    it('are updated by the admin and audited with old and new values', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');

      const { body } = await patchSettings(cookies, {
        timeZone: 'America/Manaus',
        defaultAppointmentMinutes: 45,
      }).expect(200);
      expect(body).toMatchObject({
        timeZone: 'America/Manaus',
        defaultAppointmentMinutes: 45,
      });

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.schedule_settings_updated' },
      });
      expect(log).toMatchObject({
        tenantId: clinicId,
        targetId: clinicId,
        metadata: {
          timeZone: { from: 'America/Sao_Paulo', to: 'America/Manaus' },
          defaultAppointmentMinutes: { from: 30, to: 45 },
        },
      });
    });

    it('only log the fields that changed, and nothing when unchanged', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      await patchSettings(cookies, {
        timeZone: 'America/Sao_Paulo',
        defaultAppointmentMinutes: 50,
      }).expect(200);
      await patchSettings(cookies, { defaultAppointmentMinutes: 50 }).expect(
        200,
      );

      const logs = await prisma.auditLog.findMany({
        where: { action: 'clinic.schedule_settings_updated' },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].metadata).toEqual({
        defaultAppointmentMinutes: { from: 30, to: 50 },
      });
    });

    it.each([
      { timeZone: 'Brasil' },
      { defaultAppointmentMinutes: 3 },
      { defaultAppointmentMinutes: 32 },
    ])('rejects %j', async (payload) => {
      const { cookies } = await signUpClinic(app, 'sorriso');
      await patchSettings(cookies, payload).expect(400);
    });
  });

  describe('business hours', () => {
    it('replace the whole week; missing days become closed', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');

      const { body } = await putHours(cookies, [
        { weekday: 6, opensAt: '09:00', closesAt: '13:00' },
        { weekday: 2, opensAt: '07:30', closesAt: '19:00' },
      ]).expect(200);
      expect(body.businessHours).toEqual([
        { weekday: 2, opensAt: '07:30', closesAt: '19:00' },
        { weekday: 6, opensAt: '09:00', closesAt: '13:00' },
      ]);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.business_hours_updated' },
      });
      expect(log).toMatchObject({
        tenantId: clinicId,
        metadata: {
          businessHours: {
            from: ['1 08:00-18:00', '3 08:00-12:00'],
            to: ['2 07:30-19:00', '6 09:00-13:00'],
          },
        },
      });
    });

    it('are not logged when nothing changes', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      await putHours(cookies, [
        { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
        { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
      ]).expect(200);

      expect(
        await prisma.auditLog.count({
          where: { action: 'clinic.business_hours_updated' },
        }),
      ).toBe(0);
    });

    it.each([
      [[]],
      [[{ weekday: 1, opensAt: '18:00', closesAt: '08:00' }]],
      [
        [
          { weekday: 1, opensAt: '08:00', closesAt: '12:00' },
          { weekday: 1, opensAt: '13:00', closesAt: '18:00' },
        ],
      ],
      [[{ weekday: 7, opensAt: '08:00', closesAt: '12:00' }]],
    ])('rejects %j', async (businessHours) => {
      const { cookies } = await signUpClinic(app, 'sorriso');
      await putHours(cookies, businessHours).expect(400);
    });

    it('only change the clinic of the logged user', async () => {
      const { cookies } = await signUpClinic(app, 'alfa');
      const { clinicId: betaId } = await signUpClinic(app, 'beta');

      await putHours(cookies, [
        { weekday: 5, opensAt: '10:00', closesAt: '11:00' },
      ]).expect(200);
      await patchSettings(cookies, { timeZone: 'America/Manaus' }).expect(200);

      const beta = await prisma.clinic.findUniqueOrThrow({
        where: { id: betaId },
        include: { businessHours: { orderBy: { weekday: 'asc' } } },
      });
      expect(beta.timeZone).toBe('America/Sao_Paulo');
      expect(beta.businessHours.map((hour) => hour.weekday)).toEqual([1, 3]);
    });
  });

  it('can only be changed by admins', async () => {
    const { clinicId } = await signUpClinic(app, 'sorriso');
    await createUser(prisma, clinicId, {
      email: 'recepcao@sorriso.com',
      roles: ['RECEPTION', 'PROFESSIONAL'],
    });
    const cookies = await login(app, 'recepcao@sorriso.com');

    await patchSettings(cookies, { defaultAppointmentMinutes: 60 }).expect(403);
    await putHours(cookies, [
      { weekday: 1, opensAt: '08:00', closesAt: '12:00' },
    ]).expect(403);
  });
});
