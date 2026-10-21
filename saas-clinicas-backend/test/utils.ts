import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app/configure-app.js';
import { ClinicsService } from '../src/clinics/clinics.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createTestApp(): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Apaga todos os dados (cascade a partir das clínicas e dos admins master).
 * O log de auditoria só aceita DELETE em modo de manutenção.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.audit_maintenance', 'on', true)`,
    prisma.auditLog.deleteMany(),
  ]);
  await prisma.clinic.deleteMany();
  await prisma.platformAdmin.deleteMany();
}

export const PASSWORD = 'senha-segura';

export const clinicPayload = (slug: string) => ({
  clinic: {
    name: `Clínica ${slug}`,
    email: `contato@${slug}.com`,
    phone: '(11) 3333-4444',
    document: '11.222.333/0001-81',
  },
  businessHours: [
    { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
    { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
  ],
  admin: {
    name: `Admin ${slug}`,
    email: `admin@${slug}.com`,
    temporaryPassword: PASSWORD,
  },
});

export const http = (app: INestApplication<App>) =>
  request(app.getHttpServer());

/** Faz login de clínica e devolve os cookies da sessão. */
export async function login(
  app: INestApplication<App>,
  email: string,
  password = PASSWORD,
): Promise<string[]> {
  const response = await http(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return setCookies(response);
}

/**
 * Cria uma clínica (como o master faria), dispensa a troca da senha
 * provisória e devolve a sessão do administrador.
 */
export async function signUpClinic(app: INestApplication<App>, slug: string) {
  const prisma = app.get(PrismaService);
  const { clinic, admin } = await app
    .get(ClinicsService)
    .create(clinicPayload(slug));
  await prisma.user.update({
    where: { id: admin.id },
    data: { mustChangePassword: false },
  });

  return {
    clinicId: clinic.id,
    adminId: admin.id,
    adminEmail: admin.email,
    cookies: await login(app, admin.email),
  };
}

/** Cria um usuário direto no banco, já com a senha definitiva. */
export async function createUser(
  prisma: PrismaService,
  tenantId: string,
  data: {
    email: string;
    roles: ('ADMIN' | 'PROFESSIONAL' | 'RECEPTION')[];
    name?: string;
  },
) {
  return prisma.user.create({
    data: {
      tenantId,
      name: data.name ?? data.email,
      email: data.email,
      roles: data.roles,
      passwordHash: await argon2.hash(PASSWORD),
    },
  });
}

export const MASTER_EMAIL = 'master@plataforma.com';

/** Cria um admin master e devolve a sessão de plataforma. */
export async function signInPlatformAdmin(
  app: INestApplication<App>,
): Promise<string[]> {
  await app.get(PrismaService).platformAdmin.create({
    data: {
      name: 'Master',
      email: MASTER_EMAIL,
      passwordHash: await argon2.hash(PASSWORD),
    },
  });

  const response = await http(app)
    .post('/api/platform/auth/login')
    .send({ email: MASTER_EMAIL, password: PASSWORD })
    .expect(200);
  return setCookies(response);
}

export function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as
    string | string[] | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

/** Valor de um cookie em uma lista de Set-Cookie. */
export function cookieValue(
  cookies: string[],
  name: string,
): string | undefined {
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return found?.split(';')[0].slice(name.length + 1);
}

/** Converte Set-Cookie em um header Cookie para a próxima requisição. */
export function asCookieHeader(cookies: string[]): string {
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}
