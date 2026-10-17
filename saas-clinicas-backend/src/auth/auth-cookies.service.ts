import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants.js';
import type { Session } from './auth.service.js';

/** Grava e limpa os cookies httpOnly de sessão. */
@Injectable()
export class AuthCookiesService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  set(res: Response, session: Session): void {
    res.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
      ...this.baseOptions(),
      path: '/',
      maxAge:
        this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }) * 1000,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      ...this.baseOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: session.refreshTokenExpiresAt,
    });
  }

  clear(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...this.baseOptions(), path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
    };
  }
}
