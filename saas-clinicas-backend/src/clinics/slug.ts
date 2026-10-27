/**
 * Slug da clínica: o subdomínio pelo qual a equipe acessa o sistema
 * (ex.: "sorriso" em sorriso.dominio.com). Segue as regras de um rótulo DNS.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 63;

/**
 * Header com o slug do subdomínio acessado. Quem preenche é o proxy do Nuxt,
 * a partir do Host; o valor enviado pelo navegador é descartado.
 */
export const CLINIC_SLUG_HEADER = 'x-clinic-slug';

/**
 * Subdomínios da própria plataforma ou que poderiam confundir o usuário
 * (ex.: uma "clínica" chamada admin.dominio.com).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'cdn',
  'dashboard',
  'docs',
  'ftp',
  'help',
  'login',
  'mail',
  'master',
  'painel',
  'plataforma',
  'smtp',
  'static',
  'status',
  'suporte',
  'support',
  'www',
]);

export const isReservedSlug = (slug: string): boolean =>
  RESERVED_SLUGS.has(slug);

export const isValidSlug = (slug: string): boolean =>
  slug.length >= SLUG_MIN_LENGTH &&
  slug.length <= SLUG_MAX_LENGTH &&
  SLUG_PATTERN.test(slug);

/** Sugestão de slug a partir do nome: minúsculas, sem acentos, com hífens. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
}
