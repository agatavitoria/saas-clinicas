import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { MAX_LOGO_BYTES } from '../src/clinics/branding.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  createUser,
  http,
  login,
  resetDatabase,
  createTestApp,
  signInPlatformAdmin,
  signUpClinic,
} from './utils.js';

/** Só a assinatura importa para a validação; o resto é preenchimento. */
const png = (size = 64) => {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
};

describe('Clinic branding (e2e)', () => {
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

  const uploadLogo = (cookies: string[], body: Buffer, type = 'image/png') =>
    http(app)
      .put('/api/clinics/me/branding/logo')
      .set('Cookie', asCookieHeader(cookies))
      .set('Content-Type', type)
      .send(body);

  describe('primary color', () => {
    it('is saved by the admin and returned in /clinics/me and /auth/me', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const response = await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#1565c0' })
        .expect(200);
      expect(response.body).toEqual({
        primaryColor: '#1565C0',
        logoUpdatedAt: null,
      });

      for (const path of ['/api/clinics/me', '/api/auth/me']) {
        const { body } = await http(app)
          .get(path)
          .set('Cookie', asCookieHeader(cookies))
          .expect(200);
        expect(body.branding).toEqual({
          primaryColor: '#1565C0',
          logoUpdatedAt: null,
        });
      }
    });

    it('starts empty and can go back to the default color', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const me = await http(app)
        .get('/api/auth/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);
      expect(me.body.branding).toBeNull();

      await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#2E7D32' })
        .expect(200);
      const reset = await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: null })
        .expect(200);
      expect(reset.body.primaryColor).toBeNull();
    });

    it('rejects colors without enough contrast with white', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const response = await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#FFEB3B' })
        .expect(400);
      expect(response.body.code).toBe('LOW_COLOR_CONTRAST');
    });

    it.each([{ primaryColor: 'blue' }, { primaryColor: '#12345' }, {}])(
      'rejects an invalid payload %j',
      async (payload) => {
        const { cookies } = await signUpClinic(app, 'sorriso');
        await http(app)
          .patch('/api/clinics/me/branding')
          .set('Cookie', asCookieHeader(cookies))
          .send(payload)
          .expect(400);
      },
    );

    it('is audited without personal data', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');
      await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#2E7D32' })
        .expect(200);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.branding_updated' },
      });
      expect(log).toMatchObject({
        tenantId: clinicId,
        targetId: clinicId,
        metadata: { primaryColor: { from: null, to: '#2E7D32' } },
      });
    });

    it('can only be changed by admins', async () => {
      const { clinicId } = await signUpClinic(app, 'sorriso');
      await createUser(prisma, clinicId, {
        email: 'recepcao@sorriso.com',
        roles: ['RECEPTION', 'PROFESSIONAL'],
      });
      const cookies = await login(app, 'recepcao@sorriso.com');

      await http(app)
        .patch('/api/clinics/me/branding')
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#1565C0' })
        .expect(403);
      await uploadLogo(cookies, png()).expect(403);
      await http(app)
        .delete('/api/clinics/me/branding/logo')
        .set('Cookie', asCookieHeader(cookies))
        .expect(403);
    });
  });

  describe('logo', () => {
    it('is uploaded by the admin and served to the whole team', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');
      const image = png(2048);

      const upload = await uploadLogo(cookies, image).expect(200);
      expect(upload.body.logoUpdatedAt).toEqual(expect.any(String));

      await createUser(prisma, clinicId, {
        email: 'recepcao@sorriso.com',
        roles: ['RECEPTION'],
      });
      const reception = await login(app, 'recepcao@sorriso.com');
      const response = await http(app)
        .get('/api/clinics/me/logo')
        .set('Cookie', asCookieHeader(reception))
        .buffer(true)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(response.body as Buffer, image)).toBe(0);
    });

    it('detects the format from the bytes, not from the Content-Type', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
      const response = await uploadLogo(cookies, svg).expect(400);
      expect(response.body.code).toBe('INVALID_LOGO');

      await uploadLogo(cookies, png(), 'image/webp').expect(200);
      await http(app)
        .get('/api/clinics/me/logo')
        .set('Cookie', asCookieHeader(cookies))
        .expect('Content-Type', 'image/png')
        .expect(200);
    });

    it('rejects other content types and files over the limit', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');

      const svg = await uploadLogo(
        cookies,
        Buffer.from('<svg/>'),
        'image/svg+xml',
      ).expect(400);
      expect(svg.body.code).toBe('INVALID_LOGO');

      const large = await uploadLogo(cookies, png(MAX_LOGO_BYTES + 1)).expect(
        400,
      );
      expect(large.body.code).toBe('LOGO_TOO_LARGE');
    });

    it('can be removed', async () => {
      const { cookies } = await signUpClinic(app, 'sorriso');
      await uploadLogo(cookies, png()).expect(200);

      const response = await http(app)
        .delete('/api/clinics/me/branding/logo')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);
      expect(response.body.logoUpdatedAt).toBeNull();

      await http(app)
        .get('/api/clinics/me/logo')
        .set('Cookie', asCookieHeader(cookies))
        .expect(404);
      expect(
        await prisma.auditLog.count({
          where: { action: 'clinic.logo_removed' },
        }),
      ).toBe(1);
    });

    it('requires authentication', async () => {
      await http(app).get('/api/clinics/me/logo').expect(401);
    });
  });

  it('never shows the branding of another clinic', async () => {
    const sorriso = await signUpClinic(app, 'sorriso');
    const vida = await signUpClinic(app, 'vida');

    await uploadLogo(sorriso.cookies, png()).expect(200);
    await http(app)
      .patch('/api/clinics/me/branding')
      .set('Cookie', asCookieHeader(sorriso.cookies))
      .send({ primaryColor: '#AD1457' })
      .expect(200);

    await http(app)
      .get('/api/clinics/me/logo')
      .set('Cookie', asCookieHeader(vida.cookies))
      .expect(404);
    const me = await http(app)
      .get('/api/auth/me')
      .set('Cookie', asCookieHeader(vida.cookies))
      .expect(200);
    expect(me.body.branding).toBeNull();
  });

  describe('clinic name', () => {
    it('is changed by the admin and audited without the name in metadata', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');

      const response = await http(app)
        .patch('/api/clinics/me')
        .set('Cookie', asCookieHeader(cookies))
        .send({ name: '  Sorriso Odontologia  ' })
        .expect(200);
      expect(response.body).toMatchObject({
        id: clinicId,
        name: 'Sorriso Odontologia',
      });

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.renamed' },
      });
      expect(log).toMatchObject({
        tenantId: clinicId,
        targetLabel: 'Sorriso Odontologia',
        metadata: {},
      });
    });

    it.each([{ name: 'A' }, { name: 'x'.repeat(121) }, {}])(
      'rejects an invalid name %j',
      async (payload) => {
        const { cookies } = await signUpClinic(app, 'sorriso');
        await http(app)
          .patch('/api/clinics/me')
          .set('Cookie', asCookieHeader(cookies))
          .send(payload)
          .expect(400);
      },
    );

    it('can only be changed by admins', async () => {
      const { clinicId } = await signUpClinic(app, 'sorriso');
      await createUser(prisma, clinicId, {
        email: 'recepcao@sorriso.com',
        roles: ['RECEPTION', 'PROFESSIONAL'],
      });
      const cookies = await login(app, 'recepcao@sorriso.com');

      await http(app)
        .patch('/api/clinics/me')
        .set('Cookie', asCookieHeader(cookies))
        .send({ name: 'Outro nome' })
        .expect(403);
    });

    it('is changed by the platform admin, and only for that clinic', async () => {
      const sorriso = await signUpClinic(app, 'sorriso');
      const vida = await signUpClinic(app, 'vida');
      const master = await signInPlatformAdmin(app);

      await http(app)
        .patch(`/api/platform/clinics/${sorriso.clinicId}`)
        .set('Cookie', asCookieHeader(master))
        .send({ name: 'Sorriso Centro' })
        .expect(200);

      const names = await prisma.clinic.findMany({
        select: { id: true, name: true },
      });
      expect(names).toEqual(
        expect.arrayContaining([
          { id: sorriso.clinicId, name: 'Sorriso Centro' },
          { id: vida.clinicId, name: 'Clínica vida' },
        ]),
      );
    });
  });

  it('is read-only while the clinic deletion is scheduled', async () => {
    const { clinicId, cookies } = await signUpClinic(app, 'sorriso');
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        deletionRequestedAt: new Date(),
        deletionScheduledFor: new Date(Date.now() + 86_400_000),
      },
    });

    const response = await http(app)
      .patch('/api/clinics/me/branding')
      .set('Cookie', asCookieHeader(cookies))
      .send({ primaryColor: '#1565C0' })
      .expect(403);
    expect(response.body.code).toBe('CLINIC_READ_ONLY');
  });

  describe('platform admin', () => {
    it('edits the branding of any clinic', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');
      const master = await signInPlatformAdmin(app);
      const base = `/api/platform/clinics/${clinicId}`;

      await http(app)
        .patch(`${base}/branding`)
        .set('Cookie', asCookieHeader(master))
        .send({ primaryColor: '#6D4C41' })
        .expect(200);
      await http(app)
        .put(`${base}/branding/logo`)
        .set('Cookie', asCookieHeader(master))
        .set('Content-Type', 'image/png')
        .send(png())
        .expect(200);
      await http(app)
        .get(`${base}/logo`)
        .set('Cookie', asCookieHeader(master))
        .expect(200);

      const clinic = await http(app)
        .get('/api/clinics/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);
      expect(clinic.body.branding.primaryColor).toBe('#6D4C41');

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'clinic.logo_updated' },
      });
      expect(log).toMatchObject({
        tenantId: clinicId,
        actorType: 'PLATFORM_ADMIN',
        metadata: { mimeType: 'image/png', sizeBytes: 64 },
      });
    });

    it('gets 404 for an unknown clinic', async () => {
      const master = await signInPlatformAdmin(app);
      await http(app)
        .patch(
          '/api/platform/clinics/00000000-0000-4000-8000-000000000000/branding',
        )
        .set('Cookie', asCookieHeader(master))
        .send({ primaryColor: '#6D4C41' })
        .expect(404);
    });

    it('is not reachable with a clinic session', async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');
      await http(app)
        .patch(`/api/platform/clinics/${clinicId}/branding`)
        .set('Cookie', asCookieHeader(cookies))
        .send({ primaryColor: '#6D4C41' })
        .expect(401);
    });
  });
});
