import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { EnvironmentVariables } from '../config/env.validation.js';

export const API_PREFIX = 'api';

/** Configuração compartilhada entre o bootstrap e os testes e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // O front chega pelo proxy do Nuxt: confia no X-Forwarded-For só vindo
  // de loopback, para o IP real do cliente aparecer na auditoria
  (app as NestExpressApplication).set('trust proxy', 'loopback');
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });
}
