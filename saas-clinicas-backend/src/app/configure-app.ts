import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';

/** Configuração compartilhada entre o bootstrap e os testes e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }) });
}
