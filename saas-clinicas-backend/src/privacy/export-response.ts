import type { Response } from 'express';
import type { ClinicExport } from './privacy.service.js';

/** Faz o navegador baixar a exportação como arquivo .json. */
export function sendAsDownload(
  res: Response,
  data: ClinicExport,
): ClinicExport {
  const date = data.exportedAt.toISOString().slice(0, 10);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="clinica-${data.clinic.id}-${date}.json"`,
  );
  return data;
}
