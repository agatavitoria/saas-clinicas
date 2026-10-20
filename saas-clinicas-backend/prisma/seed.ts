/**
 * Seed de desenvolvimento: cria o admin master padrão (login "admin",
 * senha "admin"). Só cria se ainda não existir, então não sobrescreve uma
 * senha já trocada. Recusa rodar em produção.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEFAULT_ADMIN = { name: 'Admin', login: 'admin', password: 'admin' };

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed de desenvolvimento: não rode em produção.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
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
  } finally {
    await prisma.$disconnect();
  }
}

await main();
