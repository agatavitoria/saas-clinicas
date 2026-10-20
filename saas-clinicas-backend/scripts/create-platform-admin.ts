/**
 * Cria (ou reativa com nova senha) um administrador da plataforma (master).
 *
 *   npm run platform:create-admin -- --name "Fulana" --email fulana@exemplo.com
 *
 * A senha vem de PLATFORM_ADMIN_PASSWORD ou é pedida no terminal.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../src/generated/prisma/client.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function fail(message: string): never {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

async function askPassword(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(
      `Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `,
    );
  } finally {
    rl.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: { name: { type: 'string' }, email: { type: 'string' } },
  });

  const name = values.name?.trim();
  const email = values.email?.trim().toLowerCase();
  if (!name || !email) fail('informe --name e --email');
  if (!EMAIL_PATTERN.test(email)) fail('e-mail inválido');

  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? (await askPassword());
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`a senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    fail('DATABASE_URL não definida (copie .env.example para .env)');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const passwordHash = await argon2.hash(password);
    const admin = await prisma.platformAdmin.upsert({
      where: { email },
      create: { name, email, passwordHash },
      update: { name, passwordHash, active: true },
    });
    console.log(`Admin master pronto: ${admin.name} <${admin.email}>`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
