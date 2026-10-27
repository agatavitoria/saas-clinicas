/**
 * Slug da clínica: o subdomínio de acesso (ex.: "sorriso" em
 * sorriso.dominio.com). Mesmas regras do backend (src/clinics/slug.ts); os
 * nomes reservados só o backend confere (erro SLUG_RESERVED).
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 63

export const isValidSlug = (slug: string): boolean =>
  slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug)

/** Sugestão a partir do nome: minúsculas, sem acentos, com hífens. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '')
}
