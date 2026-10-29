/**
 * Seed de desenvolvimento: cria o admin master padrão (login "admin",
 * senha "admin") e a clínica "demo" (http://demo.localhost:3000, login
 * "admin@demo.com", senha "demo1234"), com profissionais, recepção e
 * pacientes de exemplo para testar a agenda. Só cria o que ainda não
 * existir, então não sobrescreve uma senha já trocada. Recusa rodar em
 * produção.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEFAULT_ADMIN = { name: 'Admin', login: 'admin', password: 'admin' };

const DEMO_CLINIC = {
  name: 'Clínica Demo',
  slug: 'demo',
  email: 'contato@demo.com',
  phone: '1133334444',
  admin: { name: 'Admin Demo', email: 'admin@demo.com', password: 'demo1234' },
};

/** Equipe de exemplo da clínica demo (mesma senha do admin). */
const DEMO_TEAM = [
  { name: 'Dra. Ana Lima', email: 'ana@demo.com', roles: ['PROFESSIONAL'] },
  { name: 'Dr. Bruno Costa', email: 'bruno@demo.com', roles: ['PROFESSIONAL'] },
  { name: 'Carla Recepção', email: 'recepcao@demo.com', roles: ['RECEPTION'] },
] as const;

/** Pacientes fictícios (CPFs válidos de teste). */
const DEMO_PATIENTS = [
  { name: 'Maria Souza', cpf: '52998224725', birthDate: '1985-03-12' },
  { name: 'João Pereira', cpf: '11144477735', birthDate: '1972-11-30' },
  { name: 'Beatriz Santos', cpf: '39053344705', birthDate: '2001-07-08' },
  { name: 'Pedro Almeida', cpf: '86288366757', birthDate: '1994-01-21' },
];

async function seedPlatformAdmin(prisma: PrismaClient) {
  const existing = await prisma.platformAdmin.findUnique({
    where: { email: DEFAULT_ADMIN.login },
  });
  if (existing) {
    console.log(
      `Admin master "${DEFAULT_ADMIN.login}" já existe; nada a fazer.`,
    );
    return;
  }

  await prisma.platformAdmin.create({
    data: {
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.login,
      passwordHash: await argon2.hash(DEFAULT_ADMIN.password),
    },
  });
  console.log(
    `Admin master criado: login "${DEFAULT_ADMIN.login}", senha "${DEFAULT_ADMIN.password}".`,
  );
}

/** Clínica de exemplo, com horário comercial de segunda a sexta. */
async function seedDemoClinic(prisma: PrismaClient) {
  const existing = await prisma.clinic.findUnique({
    where: { slug: DEMO_CLINIC.slug },
  });
  if (existing) {
    console.log(`Clínica "${DEMO_CLINIC.slug}" já existe; nada a fazer.`);
    return;
  }

  const { admin, ...clinic } = DEMO_CLINIC;
  await prisma.clinic.create({
    data: {
      ...clinic,
      businessHours: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          opensAt: '08:00',
          closesAt: '18:00',
        })),
      },
      users: {
        create: {
          name: admin.name,
          email: admin.email,
          passwordHash: await argon2.hash(admin.password),
          roles: ['ADMIN'],
        },
      },
    },
  });
  console.log(
    `Clínica criada: http://${clinic.slug}.localhost:3000, login "${admin.email}", senha "${admin.password}".`,
  );
}

/** Profissionais, recepção e pacientes de exemplo; pula os que já existem. */
async function seedDemoData(prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({
    where: { slug: DEMO_CLINIC.slug },
  });
  if (!clinic) return;

  const passwordHash = await argon2.hash(DEMO_CLINIC.admin.password);
  for (const member of DEMO_TEAM) {
    const existing = await prisma.user.findUnique({
      where: { email: member.email },
    });
    if (existing) continue;
    await prisma.user.create({
      data: {
        tenantId: clinic.id,
        name: member.name,
        email: member.email,
        roles: [...member.roles],
        passwordHash,
      },
    });
    console.log(`Usuário de exemplo criado: "${member.email}".`);
  }

  for (const patient of DEMO_PATIENTS) {
    const existing = await prisma.patient.findUnique({
      where: { tenantId_cpf: { tenantId: clinic.id, cpf: patient.cpf } },
    });
    if (existing) continue;
    await prisma.patient.create({
      data: {
        tenantId: clinic.id,
        name: patient.name,
        cpf: patient.cpf,
        birthDate: new Date(`${patient.birthDate}T00:00:00Z`),
      },
    });
    console.log(`Paciente de exemplo criado: "${patient.name}".`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed de desenvolvimento: não rode em produção.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await seedPlatformAdmin(prisma);
    await seedDemoClinic(prisma);
    await seedDemoData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
