import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { CLINIC_SLUG_HEADER } from '../src/clinics/slug.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  clinicPayload,
  createTestApp,
  http,
  PASSWORD,
  postLogin,
  resetDatabase,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

/** Só a assinatura importa para a validação; o resto é preenchimento. */
const png = () => {
  const bytes = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
};

describe('Clinic subdomains (e2e)', () => {
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

  describe('login', () => {
    it('only signs in on the subdomain of the user clinic', async () => {
      await signUpClinic(app, 'alfa');
      await signUpClinic(app, 'beta');
      const credentials = { email: 'admin@alfa.com', password: PASSWORD };

      await postLogin(app, credentials, 'alfa').expect(200);
      const wrongClinic = await postLogin(app, credentials, 'beta').expect(401);
      const wrongPassword = await postLogin(
        app,
        { ...credentials, password: 'senha-errada' },
        'alfa',
      ).expect(401);

      // Não revela que o e-mail existe em outra clínica
      expect(wrongClinic.body).toEqual(wrongPassword.body);
    });

    it('requires the clinic subdomain', async () => {
      await signUpClinic(app, 'alfa');

      await http(app)
        .post('/api/auth/login')
        .send({ email: 'admin@alfa.com', password: PASSWORD })
        .expect(400);
    });
  });

  describe('session', () => {
    it('rejects a token of one clinic on the subdomain of another', async () => {
      const alfa = await signUpClinic(app, 'alfa');
      await signUpClinic(app, 'beta');
      const cookies = asCookieHeader(alfa.cookies);

      await http(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .set(CLINIC_SLUG_HEADER, 'alfa')
        .expect(200);
      await http(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .set(CLINIC_SLUG_HEADER, 'beta')
        .expect(401);
    });

    it('still accepts direct API calls without the subdomain header', async () => {
      const alfa = await signUpClinic(app, 'alfa');

      await http(app)
        .get('/api/auth/me')
        .set('Cookie', asCookieHeader(alfa.cookies))
        .expect(200);
    });
  });

  describe('public theme', () => {
    it('returns the name and branding of an active clinic', async () => {
      const alfa = await signUpClinic(app, 'alfa');
      const cookies = asCookieHeader(alfa.cookies);
      await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', cookies)
        .send({ primaryColor: '#1565C0' })
        .expect(200);

      const response = await http(app)
        .get('/api/public/clinics/alfa')
        .expect(200);

      expect(response.body).toEqual({
        name: 'Clínica alfa',
        slug: 'alfa',
        primaryColor: '#1565C0',
        logoUpdatedAt: null,
      });
    });

    it('serves the logo without a session', async () => {
      const alfa = await signUpClinic(app, 'alfa');
      await http(app).get('/api/public/clinics/alfa/logo').expect(404);

      await http(app)
        .put('/api/clinics/me/branding/logo')
        .set('Cookie', asCookieHeader(alfa.cookies))
        .set('Content-Type', 'image/png')
        .send(png())
        .expect(200);

      const response = await http(app)
        .get('/api/public/clinics/alfa/logo')
        .expect(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('does not tell an inactive clinic apart from an unknown one', async () => {
      const alfa = await signUpClinic(app, 'alfa');
      await prisma.clinic.update({
        where: { id: alfa.clinicId },
        data: { active: false },
      });

      const inactive = await http(app)
        .get('/api/public/clinics/alfa')
        .expect(404);
      const unknown = await http(app)
        .get('/api/public/clinics/nenhuma')
        .expect(404);
      await http(app).get('/api/public/clinics/Inv%C3%A1lido').expect(404);

      expect(inactive.body.code).toBe('CLINIC_NOT_FOUND');
      expect(unknown.body).toEqual(inactive.body);
    });
  });

  describe('slug', () => {
    let master: string;

    beforeEach(async () => {
      master = asCookieHeader(await signInPlatformAdmin(app));
    });

    const createClinic = (payload: object) =>
      http(app)
        .post('/api/platform/clinics')
        .set('Cookie', master)
        .send(payload);

    it('is chosen by the master when creating the clinic', async () => {
      const payload = clinicPayload('sorriso');
      payload.clinic.slug = ' Sorriso ';

      const response = await createClinic(payload).expect(201);
      expect(response.body.clinic.slug).toBe('sorriso');

      const list = await http(app)
        .get('/api/platform/clinics')
        .set('Cookie', master)
        .expect(200);
      expect(list.body[0]).toMatchObject({ slug: 'sorriso' });
    });

    it('is unique across the platform', async () => {
      await createClinic(clinicPayload('sorriso')).expect(201);

      const duplicate = clinicPayload('outra');
      duplicate.clinic.slug = 'sorriso';
      const response = await createClinic(duplicate).expect(409);

      expect(response.body.code).toBe('SLUG_TAKEN');
      expect(await prisma.clinic.count()).toBe(1);
    });

    it('cannot use a reserved name or an invalid format', async () => {
      const reserved = await createClinic(clinicPayload('admin')).expect(400);
      expect(reserved.body.code).toBe('SLUG_RESERVED');

      const invalid = clinicPayload('sorriso');
      invalid.clinic.slug = 'clínica sorriso';
      await createClinic(invalid).expect(400);

      expect(await prisma.clinic.count()).toBe(0);
    });

    it('cannot be changed afterwards', async () => {
      const alfa = await signUpClinic(app, 'alfa');

      await http(app)
        .patch('/api/clinics/me')
        .set('Cookie', asCookieHeader(alfa.cookies))
        .send({ name: 'Clínica Alfa', slug: 'outra' })
        .expect(400);
      await http(app)
        .patch(`/api/platform/clinics/${alfa.clinicId}`)
        .set('Cookie', master)
        .send({ name: 'Clínica Alfa', slug: 'outra' })
        .expect(400);

      const clinic = await prisma.clinic.findUniqueOrThrow({
        where: { id: alfa.clinicId },
      });
      expect(clinic.slug).toBe('alfa');
    });
  });
});
