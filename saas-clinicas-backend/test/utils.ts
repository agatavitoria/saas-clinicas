import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app/configure-app.js';
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

/** Apaga todos os dados de negócio (cascade a partir das clínicas). */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.clinic.deleteMany();
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
    password: PASSWORD,
  },
});

/** Cria uma clínica e devolve os cookies de sessão do administrador. */
export async function signUpClinic(app: INestApplication<App>, slug: string) {
  const response = await request(app.getHttpServer())
    .post('/api/clinics')
    .send(clinicPayload(slug))
    .expect(201);

  return {
    clinicId: response.body.clinic.id as string,
    adminId: response.body.admin.id as string,
    cookies: setCookies(response),
  };
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
