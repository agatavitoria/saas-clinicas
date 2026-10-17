import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://localhost/db' });

    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
  });

  it('converts PORT to a number', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://localhost/db',
      PORT: '4000',
    });

    expect(env.PORT).toBe(4000);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
