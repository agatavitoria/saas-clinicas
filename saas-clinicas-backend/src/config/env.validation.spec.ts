import { validateEnv } from './env.validation.js';

const required = {
  DATABASE_URL: 'postgresql://localhost/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(required);

    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.LOGIN_RATE_LIMIT).toBe(5);
  });

  it('converts numeric variables', () => {
    const env = validateEnv({ ...required, PORT: '4000' });

    expect(env.PORT).toBe(4000);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('parses COOKIE_SECURE=%s as %s', (value, expected) => {
    expect(
      validateEnv({ ...required, COOKIE_SECURE: value }).COOKIE_SECURE,
    ).toBe(expected);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'x'.repeat(32) })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('fails when JWT_ACCESS_SECRET is too short', () => {
    expect(() =>
      validateEnv({ ...required, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
