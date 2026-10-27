import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClinicsService } from './clinics.service.js';
import type { CreateClinicDto } from './dto/create-clinic.dto.js';

const dto: CreateClinicDto = {
  clinic: {
    name: 'Clínica Sorriso',
    slug: 'sorriso',
    email: 'contato@sorriso.com',
    phone: '11999998888',
    document: '11222333000181',
  },
  businessHours: [{ weekday: 1, opensAt: '08:00', closesAt: '18:00' }],
  admin: {
    name: 'Ana Souza',
    email: 'ana@sorriso.com',
    temporaryPassword: 'senha-segura',
  },
};

describe('ClinicsService', () => {
  let service: ClinicsService;
  const create = vi.fn();
  const audit = { log: vi.fn() };
  // Transação interativa: executa o callback com o próprio "tx"
  const tx = { clinic: { create } };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };

  beforeEach(async () => {
    create.mockReset();
    audit.log.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ClinicsService);
  });

  it('creates the clinic, business hours and an admin user in one write', async () => {
    const admin = {
      id: 'user-1',
      tenantId: 'clinic-1',
      name: 'Ana Souza',
      email: 'ana@sorriso.com',
      roles: ['ADMIN'],
    };
    create.mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica Sorriso',
      users: [admin],
    });

    const result = await service.create(dto);

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data.slug).toBe('sorriso');
    expect(data.businessHours.create).toEqual(dto.businessHours);
    expect(data.users.create).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@sorriso.com',
      roles: ['ADMIN'],
      mustChangePassword: true,
    });
    expect(result).toEqual({
      clinic: {
        id: 'clinic-1',
        name: 'Clínica Sorriso',
        deletion: expect.objectContaining({ status: 'NONE' }),
      },
      admin,
    });
  });

  it('audits the clinic and admin creation in the same transaction', async () => {
    create.mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica Sorriso',
      users: [{ id: 'user-1', name: 'Ana Souza', roles: ['ADMIN'] }],
    });

    await service.create(dto);

    expect(audit.log).toHaveBeenCalledWith(tx, 'clinic.created', {
      tenantId: 'clinic-1',
      target: { type: 'Clinic', id: 'clinic-1', label: 'Clínica Sorriso' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      'user.created',
      expect.objectContaining({
        tenantId: 'clinic-1',
        metadata: { roles: ['ADMIN'] },
      }),
    );
  });

  it('stores an argon2 hash, never the plain password', async () => {
    create.mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica Sorriso',
      users: [{ id: 'user-1', name: 'Ana' }],
    });

    await service.create(dto);

    const { passwordHash } = create.mock.calls[0][0].data.users.create;
    expect(passwordHash).not.toBe(dto.admin.temporaryPassword);
    expect(await argon2.verify(passwordHash, dto.admin.temporaryPassword)).toBe(
      true,
    );
  });

  it('never selects the password hash in the response', async () => {
    create.mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica Sorriso',
      users: [{ id: 'user-1', name: 'Ana' }],
    });

    await service.create(dto);

    const { select } = create.mock.calls[0][0];
    expect(select.users.select).not.toHaveProperty('passwordHash');
  });

  const uniqueViolation = (fields: string[]) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: fields },
    });

  it('reports EMAIL_IN_USE when the email is already in use', async () => {
    create.mockRejectedValue(uniqueViolation(['email']));

    const error = await service.create(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'EMAIL_IN_USE',
    });
  });

  it('reports SLUG_TAKEN when another clinic has the same slug', async () => {
    create.mockRejectedValue(uniqueViolation(['slug']));

    const error = await service.create(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'SLUG_TAKEN',
    });
  });

  it('rejects a reserved slug before writing', async () => {
    const reserved = structuredClone(dto);
    reserved.clinic.slug = 'admin';

    const error = await service.create(reserved).catch((e: unknown) => e);

    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'SLUG_RESERVED',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected errors', async () => {
    const error = new Error('connection lost');
    create.mockRejectedValue(error);

    await expect(service.create(dto)).rejects.toBe(error);
  });
});
