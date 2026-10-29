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

/**
 * As clínicas de teste abrem segunda das 08:00 às 18:00 e quarta das 08:00
 * às 12:00, no fuso America/Sao_Paulo (UTC-3, sem horário de verão).
 */
const nextWeekday = (weekday: number, weeksAhead = 1) => {
  const date = new Date();
  date.setUTCDate(
    date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7) + 7 * weeksAhead,
  );
  return date.toISOString().slice(0, 10);
};
const MONDAY = nextWeekday(1);
const TUESDAY = nextWeekday(2);
const at = (date: string, time: string) => `${date}T${time}:00-03:00`;

describe('Appointments (e2e)', () => {
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

  /** Clínica com admin, recepção, dois profissionais e um paciente. */
  async function setupClinic(slug: string) {
    const { clinicId, cookies: admin } = await signUpClinic(app, slug);
    const reception = await createUser(prisma, clinicId, {
      email: `recepcao@${slug}.com`,
      roles: ['RECEPTION'],
    });
    const ana = await createUser(prisma, clinicId, {
      email: `ana@${slug}.com`,
      name: 'Dra. Ana',
      roles: ['PROFESSIONAL'],
    });
    const bruno = await createUser(prisma, clinicId, {
      email: `bruno@${slug}.com`,
      name: 'Dr. Bruno',
      roles: ['PROFESSIONAL', 'ADMIN'],
    });
    const patient = await prisma.patient.create({
      data: {
        tenantId: clinicId,
        name: 'Maria Silva',
        cpf: '52998224725',
        birthDate: new Date('1990-05-20'),
      },
    });
    return {
      clinicId,
      admin,
      receptionId: reception.id,
      reception: await login(app, reception.email),
      anaId: ana.id,
      ana: await login(app, ana.email),
      brunoId: bruno.id,
      patientId: patient.id,
    };
  }

  type Clinic = Awaited<ReturnType<typeof setupClinic>>;

  const book = (
    cookies: string[],
    clinic: Clinic,
    overrides: Record<string, unknown> = {},
  ) =>
    http(app)
      .post('/api/appointments')
      .set('Cookie', asCookieHeader(cookies))
      .send({
        patientId: clinic.patientId,
        professionalId: clinic.anaId,
        startsAt: at(MONDAY, '09:00'),
        durationMinutes: 30,
        ...overrides,
      });

  const patch = (cookies: string[], path: string, body: object) =>
    http(app)
      .patch(`/api/appointments/${path}`)
      .set('Cookie', asCookieHeader(cookies))
      .send(body);

  const list = (cookies: string[], query: Record<string, string>) =>
    http(app)
      .get('/api/appointments')
      .set('Cookie', asCookieHeader(cookies))
      .query(query);

  /** Agendamento já começado, inserido direto no banco. */
  const insertStarted = (clinic: Clinic) => {
    const startsAt = new Date(Date.now() - 60 * 60 * 1000);
    return prisma.appointment.create({
      data: {
        tenantId: clinic.clinicId,
        patientId: clinic.patientId,
        professionalId: clinic.anaId,
        createdById: clinic.receptionId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      },
    });
  };

  describe('booking', () => {
    it('creates an appointment and audits it without the notes', async () => {
      const clinic = await setupClinic('alfa');

      const { body } = await book(clinic.reception, clinic, {
        notes: 'Primeira consulta',
      }).expect(201);
      expect(body).toMatchObject({
        status: 'SCHEDULED',
        outsideBusinessHours: false,
        notes: 'Primeira consulta',
        startsAt: new Date(at(MONDAY, '09:00')).toISOString(),
        endsAt: new Date(at(MONDAY, '09:30')).toISOString(),
        patient: { id: clinic.patientId, name: 'Maria Silva' },
        professional: { id: clinic.anaId, name: 'Dra. Ana' },
      });

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'appointment.created' },
      });
      expect(log).toMatchObject({
        tenantId: clinic.clinicId,
        targetId: body.id,
        metadata: { professionalId: clinic.anaId, outsideBusinessHours: false },
      });
      expect(JSON.stringify(log.metadata)).not.toContain('Primeira');
    });

    it('refuses overlapping times for the same professional', async () => {
      const clinic = await setupClinic('alfa');
      await book(clinic.reception, clinic).expect(201);

      const overlap = await book(clinic.reception, clinic, {
        startsAt: at(MONDAY, '09:15'),
      }).expect(409);
      expect(overlap.body.code).toBe('APPOINTMENT_CONFLICT');

      // Encostado no anterior e com outro profissional no mesmo horário: ok
      await book(clinic.reception, clinic, {
        startsAt: at(MONDAY, '09:30'),
      }).expect(201);
      await book(clinic.reception, clinic, {
        professionalId: clinic.brunoId,
      }).expect(201);
    });

    it('allows only one of two simultaneous bookings for the same slot', async () => {
      const clinic = await setupClinic('alfa');

      const results = await Promise.all([
        book(clinic.reception, clinic),
        book(clinic.admin, clinic),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await prisma.appointment.count()).toBe(1);
    });

    it('frees the slot when the appointment is cancelled', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);

      await patch(clinic.reception, `${body.id}/status`, {
        status: 'CANCELLED',
      }).expect(200);
      await book(clinic.reception, clinic).expect(201);
    });

    it('requires confirmation to book outside business hours', async () => {
      const clinic = await setupClinic('alfa');

      for (const startsAt of [at(MONDAY, '07:30'), at(TUESDAY, '10:00')]) {
        const refused = await book(clinic.reception, clinic, {
          startsAt,
        }).expect(422);
        expect(refused.body.code).toBe('OUTSIDE_BUSINESS_HOURS');
      }
      // Termina depois do fechamento (18:00)
      await book(clinic.reception, clinic, {
        startsAt: at(MONDAY, '17:45'),
      }).expect(422);

      const { body } = await book(clinic.reception, clinic, {
        startsAt: at(TUESDAY, '10:00'),
        allowOutsideBusinessHours: true,
      }).expect(201);
      expect(body.outsideBusinessHours).toBe(true);
    });

    it('refuses the past, invalid professionals and inactive patients', async () => {
      const clinic = await setupClinic('alfa');

      const past = await book(clinic.reception, clinic, {
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        allowOutsideBusinessHours: true,
      }).expect(400);
      expect(past.body.code).toBe('APPOINTMENT_IN_PAST');

      const notProfessional = await book(clinic.reception, clinic, {
        professionalId: clinic.receptionId,
      }).expect(400);
      expect(notProfessional.body.code).toBe('INVALID_PROFESSIONAL');

      await prisma.user.update({
        where: { id: clinic.brunoId },
        data: { active: false },
      });
      await book(clinic.reception, clinic, {
        professionalId: clinic.brunoId,
      }).expect(400);

      await prisma.patient.update({
        where: { id: clinic.patientId },
        data: { active: false },
      });
      const inactive = await book(clinic.reception, clinic).expect(409);
      expect(inactive.body.code).toBe('PATIENT_INACTIVE');
    });

    it.each([
      { durationMinutes: 0 },
      { durationMinutes: 7 },
      { durationMinutes: 485 },
      { startsAt: '2026-11-02 09:00' },
      { startsAt: '2026-11-02T09:00:00' },
      { patientId: 'nope' },
    ])('rejects the payload %j', async (overrides) => {
      const clinic = await setupClinic('alfa');
      await book(clinic.reception, clinic, overrides).expect(400);
    });
  });

  describe('status', () => {
    it('confirms, cancels with a reason and keeps final statuses final', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);

      await patch(clinic.reception, `${body.id}/status`, {
        status: 'CONFIRMED',
      }).expect(200);
      const cancelled = await patch(clinic.reception, `${body.id}/status`, {
        status: 'CANCELLED',
        cancelReason: 'Paciente viajou',
      }).expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Paciente viajou',
      });

      const again = await patch(clinic.reception, `${body.id}/status`, {
        status: 'CONFIRMED',
      }).expect(409);
      expect(again.body.code).toBe('INVALID_STATUS_TRANSITION');

      const logs = await prisma.auditLog.findMany({
        where: { action: 'appointment.status_changed' },
        orderBy: { occurredAt: 'asc' },
      });
      expect(logs.map((log) => log.metadata)).toEqual([
        { status: { from: 'SCHEDULED', to: 'CONFIRMED' } },
        { status: { from: 'CONFIRMED', to: 'CANCELLED' } },
      ]);
    });

    it('only accepts a cancel reason when cancelling', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);

      await patch(clinic.reception, `${body.id}/status`, {
        status: 'CONFIRMED',
        cancelReason: 'x',
      }).expect(400);
      await patch(clinic.reception, `${body.id}/status`, {
        status: 'SCHEDULED',
      }).expect(400);
    });

    it('marks completed or no-show only after the start time', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);

      const early = await patch(clinic.reception, `${body.id}/status`, {
        status: 'COMPLETED',
      }).expect(409);
      expect(early.body.code).toBe('APPOINTMENT_NOT_STARTED');

      const started = await insertStarted(clinic);
      await patch(clinic.ana, `${started.id}/status`, {
        status: 'NO_SHOW',
      }).expect(200);
    });
  });

  describe('rescheduling', () => {
    it('moves the appointment and resets the confirmation', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);
      await patch(clinic.reception, `${body.id}/status`, {
        status: 'CONFIRMED',
      }).expect(200);

      const moved = await patch(clinic.reception, body.id, {
        startsAt: at(MONDAY, '14:00'),
        durationMinutes: 60,
        professionalId: clinic.brunoId,
      }).expect(200);
      expect(moved.body).toMatchObject({
        status: 'SCHEDULED',
        startsAt: new Date(at(MONDAY, '14:00')).toISOString(),
        endsAt: new Date(at(MONDAY, '15:00')).toISOString(),
        professional: { id: clinic.brunoId },
      });

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'appointment.rescheduled' },
      });
      expect(log.metadata).toEqual({
        fields: ['professional', 'startsAt', 'duration'],
        professionalId: clinic.brunoId,
        outsideBusinessHours: false,
      });
    });

    it('changes only the notes without touching the status', async () => {
      const clinic = await setupClinic('alfa');
      const { body } = await book(clinic.reception, clinic).expect(201);
      await patch(clinic.reception, `${body.id}/status`, {
        status: 'CONFIRMED',
      }).expect(200);

      const updated = await patch(clinic.reception, body.id, {
        notes: 'Trazer exames',
      }).expect(200);
      expect(updated.body).toMatchObject({
        status: 'CONFIRMED',
        notes: 'Trazer exames',
      });
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'appointment.updated' },
      });
      expect(log.metadata).toEqual({ fields: ['notes'] });
    });

    it('refuses conflicts, closed hours and finished appointments', async () => {
      const clinic = await setupClinic('alfa');
      const first = await book(clinic.reception, clinic).expect(201);
      const second = await book(clinic.reception, clinic, {
        startsAt: at(MONDAY, '10:00'),
      }).expect(201);

      const overlap = await patch(clinic.reception, second.body.id, {
        startsAt: at(MONDAY, '09:15'),
      }).expect(409);
      expect(overlap.body.code).toBe('APPOINTMENT_CONFLICT');

      await patch(clinic.reception, second.body.id, {
        startsAt: at(TUESDAY, '10:00'),
      }).expect(422);

      await patch(clinic.reception, `${first.body.id}/status`, {
        status: 'CANCELLED',
      }).expect(200);
      const finished = await patch(clinic.reception, first.body.id, {
        startsAt: at(MONDAY, '11:00'),
      }).expect(409);
      expect(finished.body.code).toBe('APPOINTMENT_NOT_EDITABLE');
    });
  });

  describe('permissions', () => {
    it('lets professionals manage only their own agenda', async () => {
      const clinic = await setupClinic('alfa');

      const own = await book(clinic.ana, clinic).expect(201);
      const other = await book(clinic.ana, clinic, {
        professionalId: clinic.brunoId,
      }).expect(403);
      expect(other.body.code).toBe('NOT_OWN_APPOINTMENT');

      const brunos = await book(clinic.reception, clinic, {
        professionalId: clinic.brunoId,
      }).expect(201);
      await patch(clinic.ana, `${brunos.body.id}/status`, {
        status: 'CANCELLED',
      }).expect(403);
      await patch(clinic.ana, brunos.body.id, {
        startsAt: at(MONDAY, '11:00'),
      }).expect(403);
      // Nem passando a própria agenda para outro profissional
      await patch(clinic.ana, own.body.id, {
        professionalId: clinic.brunoId,
      }).expect(403);

      // Todos consultam a agenda inteira
      const { body } = await list(clinic.ana, {
        from: at(MONDAY, '00:00'),
        to: at(TUESDAY, '00:00'),
      }).expect(200);
      expect(body).toHaveLength(2);
    });
  });

  describe('listing', () => {
    it('returns appointments overlapping the range, filtered by professional', async () => {
      const clinic = await setupClinic('alfa');
      await book(clinic.reception, clinic).expect(201);
      await book(clinic.reception, clinic, {
        startsAt: at(MONDAY, '11:00'),
        professionalId: clinic.brunoId,
      }).expect(201);
      await book(clinic.reception, clinic, {
        startsAt: at(TUESDAY, '10:00'),
        allowOutsideBusinessHours: true,
      }).expect(201);

      const monday = await list(clinic.reception, {
        from: at(MONDAY, '00:00'),
        to: at(TUESDAY, '00:00'),
      }).expect(200);
      expect(monday.body.map((a: { startsAt: string }) => a.startsAt)).toEqual([
        new Date(at(MONDAY, '09:00')).toISOString(),
        new Date(at(MONDAY, '11:00')).toISOString(),
      ]);

      // O das 09:00–09:30 sobrepõe [09:15, 09:20)
      const partial = await list(clinic.reception, {
        from: at(MONDAY, '09:15'),
        to: at(MONDAY, '09:20'),
      }).expect(200);
      expect(partial.body).toHaveLength(1);

      const anaOnly = await list(clinic.reception, {
        from: at(MONDAY, '00:00'),
        to: at(TUESDAY, '23:59'),
        professionalId: clinic.anaId,
      }).expect(200);
      expect(anaOnly.body).toHaveLength(2);
    });

    it('rejects an inverted or too long range', async () => {
      const clinic = await setupClinic('alfa');
      const inverted = await list(clinic.reception, {
        from: at(TUESDAY, '00:00'),
        to: at(MONDAY, '00:00'),
      }).expect(400);
      expect(inverted.body.code).toBe('INVALID_DATE_RANGE');

      await list(clinic.reception, {
        from: at(MONDAY, '00:00'),
        to: at(nextWeekday(1, 7), '00:00'),
      }).expect(400);
    });

    it('lists only active professionals', async () => {
      const clinic = await setupClinic('alfa');
      await prisma.user.update({
        where: { id: clinic.brunoId },
        data: { active: false },
      });

      const { body } = await http(app)
        .get('/api/professionals')
        .set('Cookie', asCookieHeader(clinic.reception))
        .expect(200);
      expect(body).toEqual([{ id: clinic.anaId, name: 'Dra. Ana' }]);
    });
  });

  describe('tenant isolation', () => {
    it('never reads or changes appointments of another clinic', async () => {
      const alfa = await setupClinic('alfa');
      const beta = await setupClinic('beta');
      const { body } = await book(alfa.reception, alfa).expect(201);

      const { body: listed } = await list(beta.reception, {
        from: at(MONDAY, '00:00'),
        to: at(TUESDAY, '00:00'),
      }).expect(200);
      expect(listed).toEqual([]);

      await patch(beta.admin, body.id, { notes: 'x' }).expect(404);
      await patch(beta.admin, `${body.id}/status`, {
        status: 'CANCELLED',
      }).expect(404);

      // Paciente e profissional de outra clínica não servem
      await book(beta.reception, beta, { patientId: alfa.patientId }).expect(
        404,
      );
      await book(beta.reception, beta, {
        professionalId: alfa.anaId,
      }).expect(400);

      const { body: professionals } = await http(app)
        .get('/api/professionals')
        .set('Cookie', asCookieHeader(beta.reception))
        .expect(200);
      expect(professionals.map((p: { id: string }) => p.id)).not.toContain(
        alfa.anaId,
      );
      expect(
        await prisma.appointment.findUniqueOrThrow({ where: { id: body.id } }),
      ).toMatchObject({ status: 'SCHEDULED', notes: null });
    });
  });
});
