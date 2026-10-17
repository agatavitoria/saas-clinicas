import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Precisa ser definido antes de o AppModule (e o ConfigModule) ser carregado
process.env.LOGIN_RATE_LIMIT = '3';
const { createTestApp } = await import('./utils.js');

describe('Login rate limit (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after too many login attempts', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ninguem@teste.com', password: 'qualquer-coisa' });

    for (let i = 0; i < 3; i++) await attempt().expect(401);
    await attempt().expect(429);
  });
});
