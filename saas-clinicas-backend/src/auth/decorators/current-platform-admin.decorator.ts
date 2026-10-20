import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthPlatformAdmin } from '../auth-user.js';

/** Admin da plataforma autenticado (preenchido pelo JwtAuthGuard). */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPlatformAdmin =>
    context
      .switchToHttp()
      .getRequest<Request & { platformAdmin: AuthPlatformAdmin }>()
      .platformAdmin,
);
