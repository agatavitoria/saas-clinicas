import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  cookieValue,
  createTestApp,
  http,
  PASSWORD,
  resetDatabase,
  setCookies,
  signUpClinic,
  postLogin,
} from './utils.js';

describe('Mandatory password change (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let session: string[];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const clinic = await signUpClinic(app, 'alfa');
    // Volta para senha provisória e entra de novo
    await prisma.user.update({
      where: { id: clinic.adminId },
      data: { mustChangePassword: true },
    });
    const response = await postLogin(app, {
      email: clinic.adminEmail,
      password: PASSWORD,
    }).expect(200);
    expect(response.body.user.mustChangePassword).toBe(true);
    session = setCookies(response);
  });

  afterAll(async () => {
    await app.close();
  });

  const changePassword = (body: object) =>
    http(app)
      .post('/api/auth/change-password')
      .set('Cookie', asCookieHeader(session))
      .send(body);

  it('blocks other routes until the password is changed', async () => {
    const response = await http(app)
      .get('/api/users')
      .set('Cookie', asCookieHeader(session))
      .expect(403);
    expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Mas o perfil continua acessível, para o front saber o que mostrar
    const me = await http(app)
      .get('/api/auth/me')
      .set('Cookie', asCookieHeader(session))
      .expect(200);
    expect(me.body.mustChangePassword).toBe(true);
  });

  it('rejects a wrong current password', async () => {
    const response = await changePassword({
      currentPassword: 'errada-123',
      newPassword: 'nova-senha-123',
    }).expect(400);
    expect(response.body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects reusing the same password', async () => {
    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    }).expect(400);
    expect(response.body.code).toBe('SAME_PASSWORD');
  });

  it('changes the password, issues a new session and revokes the old one', async () => {
    const oldRefresh = cookieValue(session, 'refresh_token');

    const response = await changePassword({
      currentPassword: PASSWORD,
      newPassword: 'nova-senha-123',
    }).expect(200);
    expect(response.body.user.mustChangePassword).toBe(false);

    const fresh = asCookieHeader(setCookies(response));
    await http(app).get('/api/users').set('Cookie', fresh).expect(200);

    await http(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${oldRefresh}`)
      .expect(401);

    await postLogin(app, {
      email: 'admin@alfa.com',
      password: 'nova-senha-123',
    }).expect(200);
  });
});
