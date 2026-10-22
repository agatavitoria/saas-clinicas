import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { ClinicLogo } from './clinic-branding.service.js';

/**
 * Envia o logo como imagem. O front pede a URL com `?v=<logoUpdatedAt>`, que
 * muda a cada troca, então o navegador pode guardar a resposta por muito
 * tempo. `nosniff` impede que os bytes sejam interpretados como outro tipo.
 */
export function sendLogo(res: Response, logo: ClinicLogo): StreamableFile {
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  return new StreamableFile(logo.bytes, {
    type: logo.mimeType,
    length: logo.bytes.length,
  });
}
