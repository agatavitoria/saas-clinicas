import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  createTestApp,
  createUser,
  http,
  login,
  resetDatabase,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

const CPF = '529.982.247-25';
const OTHER_CPF = '111.444.777-35';

const patientPayload = (overrides: object = {}) => ({
  name: 'Maria Paciente',
  cpf: CPF,
  birthDate: '1990-05-20',
  phone: '(11) 98888-7777',
  ...overrides,
});

describe('Patients (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alfa: Awaited<ReturnType<typeof signUpClinic>>;
  let admin: string;
  let reception: string;
  let pro: string;
  let pro2: string;
  let proId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alfa = await signUpClinic(app, 'alfa');
    admin = asCookieHeader(alfa.cookies);
    await createUser(prisma, alfa.clinicId, {
      email: 'rec@alfa.com',
      role: 'RECEPTION',
    });
    proId = (
      await createUser(prisma, alfa.clinicId, {
        email: 'pro@alfa.com',
        role: 'PROFESSIONAL',
        name: 'Dra. Paula',
      })
    ).id;
    await createUser(prisma, alfa.clinicId, {
      email: 'pro2@alfa.com',
      role: 'PROFESSIONAL',
    });
    reception = asCookieHeader(await login(app, 'rec@alfa.com'));
    pro = asCookieHeader(await login(app, 'pro@alfa.com'));
    pro2 = asCookieHeader(await login(app, 'pro2@alfa.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (cookie: string) => ({
    get: (path: string) => http(app).get(path).set('Cookie', cookie),
    post: (path: string, body: object = {}) =>
      http(app).post(path).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) =>
      http(app).patch(path).set('Cookie', cookie).send(body),
  });

  const createPatient = async (overrides: object = {}, cookie = reception) =>
    (
      await as(cookie)
        .post('/api/patients', patientPayload(overrides))
        .expect(201)
    ).body as { id: string; name: string };

  describe('registration', () => {
    it('lets reception register a patient (CPF and phone normalized)', async () => {
      const response = await as(reception)
        .post(
          '/api/patients',
          patientPayload({ socialName: '  ', gender: 'FEMALE' }),
        )
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Maria Paciente',
        cpf: '52998224725',
        birthDate: '1990-05-20T00:00:00.000Z',
        phone: '11988887777',
        socialName: null,
        gender: 'FEMALE',
        active: true,
      });
    });

    it('does not let professionals register or edit patients', async () => {
      const patient = await createPatient();

      await as(pro)
        .post('/api/patients', patientPayload({ cpf: OTHER_CPF }))
        .expect(403);
      await as(pro)
        .patch(`/api/patients/${patient.id}`, { name: 'Outro' })
        .expect(403);
      await as(pro)
        .patch(`/api/patients/${patient.id}/status`, { active: false })
        .expect(403);
    });

    it('requires name, a valid CPF and a valid past birth date', async () => {
      await as(reception)
        .post('/api/patients', { cpf: CPF, birthDate: '1990-05-20' })
        .expect(400);
      await as(reception)
        .post('/api/patients', patientPayload({ cpf: '123.456.789-00' }))
        .expect(400);
      await as(reception)
        .post('/api/patients', patientPayload({ birthDate: '2999-01-01' }))
        .expect(400);
      await as(reception)
        .post('/api/patients', patientPayload({ birthDate: '2024-02-31' }))
        .expect(400);
      await as(reception)
        .post('/api/patients', patientPayload({ birthDate: '20/05/1990' }))
        .expect(400);
    });

    it('keeps the CPF unique within the clinic', async () => {
      await createPatient();

      const response = await as(reception)
        .post('/api/patients', patientPayload({ name: 'Outra' }))
        .expect(409);
      expect(response.body.code).toBe('CPF_IN_USE');
    });

    it('allows the same CPF in another clinic, without mixing the data', async () => {
      const beta = await signUpClinic(app, 'beta');
      const betaAdmin = asCookieHeader(beta.cookies);
      const alfaPatient = await createPatient({ name: 'Maria na Alfa' });

      const betaPatient = await as(betaAdmin)
        .post('/api/patients', patientPayload({ name: 'Maria na Beta' }))
        .expect(201);

      expect(betaPatient.body.id).not.toBe(alfaPatient.id);
      const betaList = await as(betaAdmin).get('/api/patients').expect(200);
      expect(betaList.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Maria na Beta',
      ]);
      await as(betaAdmin).get(`/api/patients/${alfaPatient.id}`).expect(404);
      await as(betaAdmin)
        .patch(`/api/patients/${alfaPatient.id}`, { name: 'Outro nome' })
        .expect(404);
    });

    it('updates only what was sent, clears optional fields with null and logs field names only', async () => {
      const patient = await createPatient({ email: 'maria@email.com' });

      const response = await as(reception)
        .patch(`/api/patients/${patient.id}`, {
          phone: null,
          socialName: 'Mari',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        name: 'Maria Paciente',
        phone: null,
        socialName: 'Mari',
        email: 'maria@email.com',
      });

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'patient.updated' },
      });
      expect(log.metadata).toEqual({ fields: ['socialName', 'phone'] });

      await as(reception)
        .patch(`/api/patients/${patient.id}`, { name: null })
        .expect(400);
      await as(reception)
        .patch(`/api/patients/${patient.id}`, { cpf: null })
        .expect(400);
    });

    it('rejects changing the CPF to one already in use', async () => {
      await createPatient();
      const other = await createPatient({ name: 'João', cpf: OTHER_CPF });

      const response = await as(reception)
        .patch(`/api/patients/${other.id}`, { cpf: CPF })
        .expect(409);
      expect(response.body.code).toBe('CPF_IN_USE');
    });
  });

  describe('listing and viewing', () => {
    it('searches by name (case-insensitive) or CPF prefix, with pagination', async () => {
      await createPatient({ name: 'Maria Silva' });
      await createPatient({ name: 'João Souza', cpf: OTHER_CPF });

      const byName = await as(pro)
        .get('/api/patients?search=maria')
        .expect(200);
      expect(byName.body).toMatchObject({ total: 1, page: 1 });
      expect(byName.body.items[0].name).toBe('Maria Silva');

      const byCpf = await as(pro)
        .get('/api/patients?search=111.444')
        .expect(200);
      expect(byCpf.body.items.map((p: { name: string }) => p.name)).toEqual([
        'João Souza',
      ]);

      const paged = await as(pro)
        .get('/api/patients?pageSize=1&page=2')
        .expect(200);
      expect(paged.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect(paged.body.items).toHaveLength(1);
    });

    it('hides inactive patients by default', async () => {
      const patient = await createPatient();
      await as(reception)
        .patch(`/api/patients/${patient.id}/status`, { active: false })
        .expect(200);

      expect((await as(pro).get('/api/patients').expect(200)).body.total).toBe(
        0,
      );
      const inactive = await as(pro)
        .get('/api/patients?status=inactive')
        .expect(200);
      expect(inactive.body.items[0]).toMatchObject({
        id: patient.id,
        active: false,
      });
    });

    it('records who opened the patient file', async () => {
      const patient = await createPatient();

      await as(pro).get(`/api/patients/${patient.id}`).expect(200);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'patient.viewed' },
      });
      expect(log).toMatchObject({
        actorId: proId,
        targetId: patient.id,
        tenantId: alfa.clinicId,
      });
    });
  });

  describe('records (prontuário)', () => {
    it('lets professionals add records that everyone in the clinic can read', async () => {
      const patient = await createPatient();

      const created = await as(pro)
        .post(`/api/patients/${patient.id}/records`, {
          notes: 'Primeira consulta. Queixa de dor lombar.',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        notes: 'Primeira consulta. Queixa de dor lombar.',
        professional: { id: proId, name: 'Dra. Paula', role: 'PROFESSIONAL' },
        amendments: [],
      });

      const asReception = await as(reception)
        .get(`/api/patients/${patient.id}/records`)
        .expect(200);
      expect(asReception.body).toHaveLength(1);
    });

    it('does not let reception write records', async () => {
      const patient = await createPatient();
      await as(reception)
        .post(`/api/patients/${patient.id}/records`, { notes: 'x' })
        .expect(403);
    });

    it('lists records newest first and filters by professional', async () => {
      const patient = await createPatient();
      await as(pro)
        .post(`/api/patients/${patient.id}/records`, {
          notes: 'Antiga',
          occurredAt: '2026-01-10T10:00:00Z',
        })
        .expect(201);
      await as(pro2)
        .post(`/api/patients/${patient.id}/records`, { notes: 'Recente' })
        .expect(201);

      const all = await as(pro)
        .get(`/api/patients/${patient.id}/records`)
        .expect(200);
      expect(all.body.map((r: { notes: string }) => r.notes)).toEqual([
        'Recente',
        'Antiga',
      ]);

      const onlyPro = await as(pro)
        .get(`/api/patients/${patient.id}/records?professionalId=${proId}`)
        .expect(200);
      expect(onlyPro.body.map((r: { notes: string }) => r.notes)).toEqual([
        'Antiga',
      ]);
    });

    it('rejects future dates and inactive patients', async () => {
      const patient = await createPatient();
      await as(pro)
        .post(`/api/patients/${patient.id}/records`, {
          notes: 'x',
          occurredAt: '2999-01-01T00:00:00Z',
        })
        .expect(400);

      await as(reception)
        .patch(`/api/patients/${patient.id}/status`, { active: false })
        .expect(200);
      const response = await as(pro)
        .post(`/api/patients/${patient.id}/records`, { notes: 'x' })
        .expect(409);
      expect(response.body.code).toBe('PATIENT_INACTIVE');
    });

    it('is immutable: corrections are amendments by the author or an admin', async () => {
      const patient = await createPatient();
      const record = (
        await as(pro)
          .post(`/api/patients/${patient.id}/records`, { notes: 'Original' })
          .expect(201)
      ).body as { id: string };
      const base = `/api/patients/${patient.id}/records/${record.id}`;

      // Não existe edição nem exclusão
      await http(app)
        .patch(base)
        .set('Cookie', pro)
        .send({ notes: 'x' })
        .expect(404);
      await http(app).delete(base).set('Cookie', pro).expect(404);

      await as(pro)
        .post(`${base}/amendments`, { notes: 'Correção: dor cervical' })
        .expect(201);
      const denied = await as(pro2)
        .post(`${base}/amendments`, { notes: 'x' })
        .expect(403);
      expect(denied.body.code).toBe('NOT_RECORD_AUTHOR');
      await as(admin)
        .post(`${base}/amendments`, { notes: 'Complemento do admin' })
        .expect(201);

      const [listed] = (
        await as(pro).get(`/api/patients/${patient.id}/records`).expect(200)
      ).body;
      expect(listed.notes).toBe('Original');
      expect(listed.amendments.map((a: { notes: string }) => a.notes)).toEqual([
        'Correção: dor cervical',
        'Complemento do admin',
      ]);

      // Adendo de adendo não é permitido
      const amendmentId = listed.amendments[0].id as string;
      const nested = await as(pro)
        .post(`/api/patients/${patient.id}/records/${amendmentId}/amendments`, {
          notes: 'x',
        })
        .expect(400);
      expect(nested.body.code).toBe('INVALID_AMENDMENT');
    });

    it('cannot amend a record through another patient', async () => {
      const patient = await createPatient();
      const other = await createPatient({ name: 'João', cpf: OTHER_CPF });
      const record = (
        await as(pro)
          .post(`/api/patients/${patient.id}/records`, { notes: 'Original' })
          .expect(201)
      ).body as { id: string };

      await as(pro)
        .post(`/api/patients/${other.id}/records/${record.id}/amendments`, {
          notes: 'x',
        })
        .expect(404);
    });

    it('is protected by the database too (RLS and grants)', async () => {
      const beta = await signUpClinic(app, 'beta');
      const patient = await createPatient();
      await as(pro)
        .post(`/api/patients/${patient.id}/records`, { notes: 'Sigiloso' })
        .expect(201);

      // Outra clínica não enxerga nada, mesmo com SQL cru
      const seen = await prisma.tenantTransaction(
        beta.clinicId,
        (tx) => tx.$queryRaw<unknown[]>`SELECT id FROM patient_records`,
      );
      expect(seen).toHaveLength(0);

      // E a própria clínica não consegue alterar o prontuário
      await expect(
        prisma.tenantTransaction(
          alfa.clinicId,
          (tx) =>
            tx.$executeRaw`UPDATE patient_records SET notes = 'adulterado'`,
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('keeps clinical text and CPF out of the audit log', async () => {
      const patient = await createPatient();
      await as(pro)
        .post(`/api/patients/${patient.id}/records`, {
          notes: 'Texto clínico sigiloso',
        })
        .expect(201);

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: alfa.clinicId },
      });
      const raw = JSON.stringify(logs);
      expect(raw).not.toContain('Texto clínico sigiloso');
      expect(raw).not.toContain('52998224725');
      expect(
        logs.find((log) => log.action === 'patient_record.created'),
      ).toBeTruthy();
    });
  });

  describe('platform and LGPD', () => {
    it('gives the master only the number of patients', async () => {
      await createPatient();
      const master = asCookieHeader(await signInPlatformAdmin(app));

      await http(app).get('/api/patients').set('Cookie', master).expect(401);

      const clinics = await http(app)
        .get('/api/platform/clinics')
        .set('Cookie', master)
        .expect(200);
      expect(clinics.body[0].patientsCount).toBe(1);

      const exported = await http(app)
        .get(`/api/platform/clinics/${alfa.clinicId}/export`)
        .set('Cookie', master)
        .expect(200);
      expect(exported.body.patientsCount).toBe(1);
      expect(exported.body).not.toHaveProperty('patients');
      expect(JSON.stringify(exported.body)).not.toContain('Maria Paciente');

      // O histórico visto pelo master também não revela o nome
      for (const path of [
        '/api/platform/audit-logs',
        `/api/platform/clinics/${alfa.clinicId}/audit-logs`,
      ]) {
        const logs = await http(app)
          .get(path)
          .set('Cookie', master)
          .expect(200);
        const created = logs.body.items.find(
          (log: { action: string }) => log.action === 'patient.created',
        );
        expect(created.target.label).toBe('Paciente');
        expect(JSON.stringify(logs.body)).not.toContain('Maria Paciente');
      }

      // Já o admin da clínica vê o nome
      const own = await as(admin)
        .get('/api/audit-logs?action=patient.created')
        .expect(200);
      expect(own.body.items[0].target.label).toBe('Maria Paciente');
    });

    it('includes patients and records in the clinic export', async () => {
      const patient = await createPatient();
      await as(pro)
        .post(`/api/patients/${patient.id}/records`, { notes: 'Consulta' })
        .expect(201);

      const exported = await as(admin)
        .get('/api/clinics/me/export')
        .expect(200);
      expect(exported.body.patients).toHaveLength(1);
      expect(exported.body.patients[0]).toMatchObject({
        name: 'Maria Paciente',
        records: [{ notes: 'Consulta', professional: { name: 'Dra. Paula' } }],
      });
    });

    it('becomes read-only while the clinic deletion is scheduled', async () => {
      const patient = await createPatient();
      await as(admin)
        .post('/api/clinics/me/deletion-request', {
          confirmationName: 'Clínica alfa',
        })
        .expect(200);
      const master = asCookieHeader(await signInPlatformAdmin(app));
      await http(app)
        .post(`/api/platform/clinics/${alfa.clinicId}/deletion/confirm`)
        .set('Cookie', master)
        .expect(200);

      await as(pro).get(`/api/patients/${patient.id}`).expect(200);
      const blocked = await as(pro)
        .post(`/api/patients/${patient.id}/records`, { notes: 'x' })
        .expect(403);
      expect(blocked.body.code).toBe('CLINIC_READ_ONLY');
    });
  });
});
