import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signUpClinic } from './utils.js';

/**
 * Prova que o próprio Postgres isola as clínicas: as consultas abaixo usam
 * SQL cru, que passa por fora do filtro da aplicação (forTenant). Só o
 * Row-Level Security impede o vazamento.
 */
describe('Row-Level Security (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alfa: Awaited<ReturnType<typeof signUpClinic>>;
  let beta: Awaited<ReturnType<typeof signUpClinic>>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alfa = await signUpClinic(app, 'alfa');
    beta = await signUpClinic(app, 'beta');
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs clinic queries under the restricted role', async () => {
    const [{ role }] = await prisma.tenantTransaction(
      alfa.clinicId,
      (tx) => tx.$queryRaw<{ role: string }[]>`SELECT current_user AS role`,
    );
    expect(role).toBe('app_tenant');

    // Fora da transação da clínica, a conexão volta ao usuário normal
    const [{ role: after }] = await prisma.$queryRaw<
      { role: string }[]
    >`SELECT current_user AS role`;
    expect(after).not.toBe('app_tenant');
  });

  it('hides other clinics even from an unfiltered raw query', async () => {
    const emails = await prisma.tenantTransaction(
      alfa.clinicId,
      (tx) => tx.$queryRaw<{ email: string }[]>`SELECT email FROM users`,
    );
    const clinics = await prisma.tenantTransaction(
      alfa.clinicId,
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM clinics`,
    );

    expect(emails.map((row) => row.email)).toEqual(['admin@alfa.com']);
    expect(clinics.map((row) => row.id)).toEqual([alfa.clinicId]);
  });

  it('blocks writing rows into another clinic', async () => {
    await expect(
      prisma.tenantTransaction(
        alfa.clinicId,
        (tx) =>
          tx.$executeRaw`
          INSERT INTO users (id, "tenantId", name, email, "passwordHash", roles, "updatedAt")
          VALUES (gen_random_uuid(), ${beta.clinicId}::uuid, 'Intruso', 'intruso@beta.com', 'x', '{ADMIN}', now())
        `,
      ),
    ).rejects.toThrow(/row-level security/);

    // Nem alterar linhas de outra clínica: o UPDATE simplesmente não as vê
    const updated = await prisma.tenantTransaction(
      alfa.clinicId,
      (tx) =>
        tx.$executeRaw`UPDATE users SET name = 'Hackeado' WHERE "tenantId" = ${beta.clinicId}::uuid`,
    );
    expect(updated).toBe(0);
    const betaAdmin = await prisma.user.findUniqueOrThrow({
      where: { id: beta.adminId },
    });
    expect(betaAdmin.name).toBe('Admin beta');
  });

  it('fails closed when no clinic is set', async () => {
    const [, rows] = await prisma.$transaction([
      prisma.$executeRaw`SET LOCAL ROLE app_tenant`,
      prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT count(*) AS total FROM users`,
    ]);
    expect(Number(rows[0].total)).toBe(0);
  });

  it('lets the restricted role only read and insert audit logs', async () => {
    await expect(
      prisma.tenantTransaction(alfa.clinicId, async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit_maintenance', 'on', true)`;
        return tx.$executeRaw`UPDATE audit_logs SET action = 'tampered'`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps concurrent clinics apart', async () => {
    const [alfaUsers, betaUsers] = await Promise.all([
      prisma.tenantTransaction(
        alfa.clinicId,
        (tx) => tx.$queryRaw<{ email: string }[]>`SELECT email FROM users`,
      ),
      prisma
        .forTenant(beta.clinicId)
        .user.findMany({ select: { email: true } }),
    ]);

    expect(alfaUsers.map((row) => row.email)).toEqual(['admin@alfa.com']);
    expect(betaUsers.map((row) => row.email)).toEqual(['admin@beta.com']);
  });
});
