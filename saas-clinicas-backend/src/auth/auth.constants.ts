/** Audiências do JWT: impedem usar um token de clínica como de plataforma. */
export const TENANT_AUDIENCE = 'tenant';
export const PLATFORM_AUDIENCE = 'platform';

export interface SessionCookieNames {
  access: { name: string; path: string };
  refresh: { name: string; path: string };
}

/** Sessão de usuário de clínica. */
export const TENANT_COOKIES: SessionCookieNames = {
  access: { name: 'access_token', path: '/' },
  // O refresh token só é enviado às rotas de autenticação
  refresh: { name: 'refresh_token', path: '/api/auth' },
};

/** Sessão de administrador da plataforma (master). */
export const PLATFORM_COOKIES: SessionCookieNames = {
  access: { name: 'platform_access_token', path: '/api/platform' },
  refresh: { name: 'platform_refresh_token', path: '/api/platform/auth' },
};
