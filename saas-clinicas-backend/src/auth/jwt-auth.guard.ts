import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { forbidden } from '../common/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthCookiesService } from './auth-cookies.service.js';
import type {
  AuthPlatformAdmin,
  AuthUser,
  PlatformAccessTokenPayload,
  TenantAccessTokenPayload,
} from './auth-user.js';
import {
  PLATFORM_AUDIENCE,
  PLATFORM_COOKIES,
  TENANT_AUDIENCE,
  TENANT_COOKIES,
} from './auth.constants.js';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from './decorators/allow-pending-password-change.decorator.js';
import { IS_PLATFORM_ROUTE_KEY } from './decorators/platform-route.decorator.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

type AuthenticatedRequest = Request & {
  user?: AuthUser;
  platformAdmin?: AuthPlatformAdmin;
};

/**
 * Guard global. Rotas @Public() passam direto; rotas @PlatformRoute()
 * exigem a sessão do admin master; as demais, a sessão de um usuário de
 * clínica. A cada requisição confere no banco se a conta (e a clínica)
 * continuam ativas, para que uma inativação valha na hora.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cookies: AuthCookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.flag(context, IS_PUBLIC_KEY)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.flag(context, IS_PLATFORM_ROUTE_KEY)) {
      request.platformAdmin = await this.authenticatePlatformAdmin(request);
      return true;
    }

    const { user, mustChangePassword } =
      await this.authenticateTenantUser(request);
    if (
      mustChangePassword &&
      !this.flag(context, ALLOW_PENDING_PASSWORD_CHANGE_KEY)
    ) {
      throw forbidden('PASSWORD_CHANGE_REQUIRED', 'Password change required');
    }
    request.user = user;
    return true;
  }

  private async authenticateTenantUser(request: Request) {
    const payload = await this.verify<TenantAccessTokenPayload>(
      this.cookies.read(request, TENANT_COOKIES.access.name),
      TENANT_AUDIENCE,
    );

    const user = await this.prisma.forTenant(payload.tenantId).user.findUnique({
      where: { id: payload.sub },
      select: {
        role: true,
        active: true,
        mustChangePassword: true,
        clinic: { select: { active: true } },
      },
    });
    if (!user?.active || !user.clinic.active) throw new UnauthorizedException();

    return {
      // O papel vem do banco: uma mudança vale sem esperar o token expirar
      user: {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: user.role,
      },
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async authenticatePlatformAdmin(
    request: Request,
  ): Promise<AuthPlatformAdmin> {
    const payload = await this.verify<PlatformAccessTokenPayload>(
      this.cookies.read(request, PLATFORM_COOKIES.access.name),
      PLATFORM_AUDIENCE,
    );

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { active: true },
    });
    if (!admin?.active) throw new UnauthorizedException();

    return { adminId: payload.sub };
  }

  private async verify<T extends object>(
    token: string | undefined,
    audience: string,
  ): Promise<T> {
    if (!token) throw new UnauthorizedException();
    try {
      return await this.jwt.verifyAsync<T>(token, { audience });
    } catch {
      throw new UnauthorizedException();
    }
  }

  private flag(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }
}
