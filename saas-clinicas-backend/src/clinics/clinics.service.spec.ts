import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClinicsService } from './clinics.service.js';
import type { CreateClinicDto } from './dto/create-clinic.dto.js';

const dto: CreateClinicDto = {
  clinic: {
    name: 'Clínica Sorriso',
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

  beforeEach(async () => {
    create.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: PrismaService, useValue: { clinic: { create } } },
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
      role: 'ADMIN',
    };
    create.mockResolvedValue({ id: 'clinic-1', users: [admin] });

    const result = await service.create(dto);

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data.businessHours.create).toEqual(dto.businessHours);
    expect(data.users.create).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@sorriso.com',
      role: 'ADMIN',
      mustChangePassword: true,
    });
    expect(result).toEqual({ clinic: { id: 'clinic-1' }, admin });
  });

  it('stores an argon2 hash, never the plain password', async () => {
    create.mockResolvedValue({ id: 'clinic-1', users: [{}] });

    await service.create(dto);

    const { passwordHash } = create.mock.calls[0][0].data.users.create;
    expect(passwordHash).not.toBe(dto.admin.temporaryPassword);
    expect(await argon2.verify(passwordHash, dto.admin.temporaryPassword)).toBe(
      true,
    );
  });

  it('never selects the password hash in the response', async () => {
    create.mockResolvedValue({ id: 'clinic-1', users: [{}] });

    await service.create(dto);

    const { select } = create.mock.calls[0][0];
    expect(select.users.select).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictException when the email is already in use', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows unexpected errors', async () => {
    const error = new Error('connection lost');
    create.mockRejectedValue(error);

    await expect(service.create(dto)).rejects.toBe(error);
  });
});
