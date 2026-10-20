import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  asCookieHeader,
  clinicPayload,
  createTestApp,
  http,
  resetDatabase,
  signUpClinic,
} from './utils.js';

describe('Clinics (e2e)', () => {
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

  it('no longer offers public clinic sign-up', async () => {
    await http(app).post('/api/clinics').send(clinicPayload('x')).expect(404);
    expect(await prisma.clinic.count()).toBe(0);
  });

  describe('GET /api/clinics/me', () => {
    it('requires authentication', async () => {
      await http(app).get('/api/clinics/me').expect(401);
    });

    it("returns the authenticated user's clinic", async () => {
      const { clinicId, cookies } = await signUpClinic(app, 'sorriso');

      const response = await http(app)
        .get('/api/clinics/me')
        .set('Cookie', asCookieHeader(cookies))
        .expect(200);

      expect(response.body).toMatchObject({
        id: clinicId,
        name: 'Clínica sorriso',
        active: true,
        businessHours: [{ weekday: 1 }, { weekday: 3 }],
      });
    });
  });
});
