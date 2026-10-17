import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TeamMember } from './team-member.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Equipe da clínica do tenant autenticado. */
  findAll(tenantId: string): Promise<TeamMember[]> {
    return this.prisma.forTenant(tenantId).user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
