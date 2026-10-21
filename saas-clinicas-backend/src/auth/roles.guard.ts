import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { type AuthUser, hasRole } from './auth-user.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

/**
 * Aplica @Roles(): libera quem tem pelo menos um dos papéis exigidos. Roda
 * depois do JwtAuthGuard, que preenche o usuário.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    // Basta ter um dos papéis exigidos
    return !!user && hasRole(user, ...roles);
  }
}
