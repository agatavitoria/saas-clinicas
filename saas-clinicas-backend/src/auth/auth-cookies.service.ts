import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { SessionCookieNames } from './auth.constants.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Grava, lê e limpa os cookies httpOnly de um tipo de sessão. */
@Injectable()
export class AuthCookiesService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  set(res: Response, names: SessionCookieNames, tokens: SessionTokens): void {
    res.cookie(names.access.name, tokens.accessToken, {
      ...this.baseOptions(),
      path: names.access.path,
      maxAge:
        this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }) * 1000,
    });
    res.cookie(names.refresh.name, tokens.refreshToken, {
      ...this.baseOptions(),
      path: names.refresh.path,
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  clear(res: Response, names: SessionCookieNames): void {
    for (const cookie of [names.access, names.refresh]) {
      res.clearCookie(cookie.name, {
        ...this.baseOptions(),
        path: cookie.path,
      });
    }
  }

  read(req: Request, name: string): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[name];
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
    };
  }
}
