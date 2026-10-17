import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const payload = (suffix: string) => ({
  clinic: {
    name: `Clínica ${suffix}`,
    email: `contato@${suffix}.com`,
    phone: '(11) 3333-4444',
    document: '11.222.333/0001-81',
  },
  businessHours: [
    { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
    { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
  ],
  admin: {
    name: 'Ana Souza',
    email: `ana@${suffix}.com`,
    password: 'senha-segura',
  },
});

describe('Clinics (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.clinic.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/clinics')
      .send(body as object);

  it('creates a clinic with its business hours and admin user', async () => {
    const response = await post(payload('sorriso')).expect(201);

    expect(response.body.clinic).toMatchObject({
      name: 'Clínica sorriso',
      email: 'contato@sorriso.com',
      phone: '1133334444',
      document: '11222333000181',
      businessHours: [
        { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
        { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
      ],
    });
    expect(response.body.admin).toMatchObject({
      tenantId: response.body.clinic.id,
      email: 'ana@sorriso.com',
      role: 'ADMIN',
    });
  });

  it('never exposes the password or its hash', async () => {
    const response = await post(payload('sorriso')).expect(201);

    expect(response.body.admin).not.toHaveProperty('passwordHash');
    expect(response.body.admin).not.toHaveProperty('password');

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'ana@sorriso.com' },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('returns 400 for an invalid payload', async () => {
    const body = payload('sorriso');
    body.businessHours[0].closesAt = '07:00';

    await post(body).expect(400);
    expect(await prisma.clinic.count()).toBe(0);
  });

  it('returns 400 for unknown properties (e.g. a client-sent tenantId)', async () => {
    await post({ ...payload('sorriso'), tenantId: 'other' }).expect(400);
  });

  it('returns 409 when the admin email is already in use and keeps no partial data', async () => {
    await post(payload('sorriso')).expect(201);

    const duplicate = payload('outra');
    duplicate.admin.email = 'ANA@sorriso.com';
    await post(duplicate).expect(409);

    expect(await prisma.clinic.count()).toBe(1);
  });

  it('links each admin only to its own clinic', async () => {
    const first = await post(payload('sorriso')).expect(201);
    const second = await post(payload('vida')).expect(201);

    const firstId = first.body.clinic.id as string;
    const secondId = second.body.clinic.id as string;
    expect(firstId).not.toBe(secondId);

    const firstUsers = await prisma.user.findMany({
      where: { tenantId: firstId },
    });
    const firstHours = await prisma.clinicBusinessHour.findMany({
      where: { tenantId: firstId },
    });
    expect(firstUsers.map((user) => user.email)).toEqual(['ana@sorriso.com']);
    expect(firstHours).toHaveLength(2);
    expect(second.body.admin.tenantId).toBe(secondId);
  });
});
