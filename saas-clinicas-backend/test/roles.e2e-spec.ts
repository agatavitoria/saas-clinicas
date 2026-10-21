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

describe('Multiple roles per user (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alfa: Awaited<ReturnType<typeof signUpClinic>>;
  let admin: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alfa = await signUpClinic(app, 'alfa');
    admin = asCookieHeader(alfa.cookies);
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (cookie: string) => ({
    post: (path: string, body: object) =>
      http(app).post(path).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) =>
      http(app).patch(path).set('Cookie', cookie).send(body),
  });

  const patient = {
    name: 'Maria Paciente',
    cpf: '529.982.247-25',
    birthDate: '1990-05-20',
  };

  it('creates a user with several roles', async () => {
    const response = await as(admin)
      .post('/api/users', {
        name: 'Dra. Ana',
        email: 'ana@alfa.com',
        roles: ['ADMIN', 'PROFESSIONAL'],
        temporaryPassword: 'provisoria-1',
      })
      .expect(201);

    expect(response.body.roles.sort()).toEqual(['ADMIN', 'PROFESSIONAL']);
  });

  it('grants the union of the permissions of every role', async () => {
    await createUser(prisma, alfa.clinicId, {
      email: 'multi@alfa.com',
      roles: ['RECEPTION', 'PROFESSIONAL'],
    });
    const multi = asCookieHeader(await login(app, 'multi@alfa.com'));

    // Recepção: cadastra o paciente
    const created = await as(multi).post('/api/patients', patient).expect(201);
    // Profissional: registra o atendimento
    await as(multi)
      .post(`/api/patients/${created.body.id}/records`, { notes: 'Consulta' })
      .expect(201);
    // Mas não é admin
    await as(multi)
      .post('/api/users', {
        name: 'X Y',
        email: 'x@alfa.com',
        roles: ['RECEPTION'],
        temporaryPassword: 'provisoria-1',
      })
      .expect(403);
  });

  it('changes roles with immediate effect and audits it', async () => {
    const user = await createUser(prisma, alfa.clinicId, {
      email: 'rec@alfa.com',
      roles: ['RECEPTION'],
    });
    const session = asCookieHeader(await login(app, 'rec@alfa.com'));
    const created = await as(session)
      .post('/api/patients', patient)
      .expect(201);
    await as(session)
      .post(`/api/patients/${created.body.id}/records`, { notes: 'x' })
      .expect(403);

    const response = await as(admin)
      .patch(`/api/users/${user.id}/roles`, {
        roles: ['RECEPTION', 'PROFESSIONAL'],
      })
      .expect(200);
    expect(response.body.roles.sort()).toEqual(['PROFESSIONAL', 'RECEPTION']);

    // A sessão aberta já ganha a permissão nova
    await as(session)
      .post(`/api/patients/${created.body.id}/records`, { notes: 'Agora pode' })
      .expect(201);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'user.roles_changed' },
    });
    expect(log.metadata).toEqual({
      roles: { from: ['RECEPTION'], to: ['PROFESSIONAL', 'RECEPTION'] },
    });
  });

  it('validates the roles list', async () => {
    const user = await createUser(prisma, alfa.clinicId, {
      email: 'rec@alfa.com',
      roles: ['RECEPTION'],
    });
    const path = `/api/users/${user.id}/roles`;

    await as(admin).patch(path, { roles: [] }).expect(400);
    await as(admin)
      .patch(path, { roles: ['RECEPTION', 'RECEPTION'] })
      .expect(400);
    await as(admin)
      .patch(path, { roles: ['SUPERUSER'] })
      .expect(400);
    await as(admin).patch(path, { role: 'ADMIN' }).expect(400);
  });

  it('does not let the admin remove their own admin role', async () => {
    await createUser(prisma, alfa.clinicId, {
      email: 'outro@alfa.com',
      roles: ['ADMIN'],
    });

    const response = await as(admin)
      .patch(`/api/users/${alfa.adminId}/roles`, { roles: ['PROFESSIONAL'] })
      .expect(409);
    expect(response.body.code).toBe('CANNOT_REMOVE_OWN_ADMIN');

    // Acrescentar papéis a si mesmo é permitido
    await as(admin)
      .patch(`/api/users/${alfa.adminId}/roles`, {
        roles: ['ADMIN', 'PROFESSIONAL'],
      })
      .expect(200);
  });

  it('keeps at least one active admin (master acting on the clinic)', async () => {
    const master = asCookieHeader(await signInPlatformAdmin(app));
    const path = `/api/platform/clinics/${alfa.clinicId}/users/${alfa.adminId}/roles`;

    const blocked = await as(master)
      .patch(path, { roles: ['PROFESSIONAL'] })
      .expect(409);
    expect(blocked.body.code).toBe('LAST_ACTIVE_ADMIN');

    await createUser(prisma, alfa.clinicId, {
      email: 'outro@alfa.com',
      roles: ['ADMIN'],
    });
    await as(master)
      .patch(path, { roles: ['PROFESSIONAL'] })
      .expect(200);
  });

  it('is restricted to admins of the same clinic', async () => {
    const user = await createUser(prisma, alfa.clinicId, {
      email: 'rec@alfa.com',
      roles: ['RECEPTION'],
    });
    const reception = asCookieHeader(await login(app, 'rec@alfa.com'));
    const beta = await signUpClinic(app, 'beta');

    await as(reception)
      .patch(`/api/users/${user.id}/roles`, { roles: ['ADMIN'] })
      .expect(403);
    await as(asCookieHeader(beta.cookies))
      .patch(`/api/users/${user.id}/roles`, { roles: ['ADMIN'] })
      .expect(404);
  });
});
