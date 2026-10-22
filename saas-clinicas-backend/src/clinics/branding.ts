/** Campos da identidade visual devolvidos pela API (sem os bytes do logo). */
export const CLINIC_BRANDING_SELECT = {
  primaryColor: true,
  logoUpdatedAt: true,
} as const;

/** Tamanho máximo do logo da clínica. */
export const MAX_LOGO_BYTES = 512 * 1024;

/**
 * Formatos aceitos. SVG fica de fora de propósito: pode carregar scripts e
 * seria servido pela mesma origem da aplicação.
 */
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type LogoMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => Array.from(Buffer.from(text, 'latin1'));

/**
 * Formato real da imagem, lido dos primeiros bytes (o Content-Type enviado
 * pelo cliente não é confiável). Devolve null se não for um formato aceito.
 */
export function detectLogoMimeType(bytes: Uint8Array): LogoMimeType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  // RIFF <tamanho em 4 bytes> WEBP
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  return null;
}
