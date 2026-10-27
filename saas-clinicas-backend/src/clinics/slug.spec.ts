import { isReservedSlug, isValidSlug, slugify } from './slug.js';

describe('clinic slug', () => {
  it.each([
    ['Clínica Sorriso', 'clinica-sorriso'],
    ['  Consultório Dr. João  ', 'consultorio-dr-joao'],
    ['Saúde & Bem-Estar 24h', 'saude-bem-estar-24h'],
    ['---', ''],
  ])('slugifies %j as %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('limits the suggestion to 63 characters without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(62)} b`);
    expect(slug).toBe('a'.repeat(62));
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['abc', 'clinica-sorriso', '123', 'a1-b2'])('accepts %j', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    'ab',
    '-sorriso',
    'sorriso-',
    'Sorriso',
    'sor_riso',
    'sor.riso',
    'clínica',
    'a'.repeat(64),
  ])('rejects %j', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('reserves the platform subdomains', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('www')).toBe(true);
    expect(isReservedSlug('sorriso')).toBe(false);
  });
});
