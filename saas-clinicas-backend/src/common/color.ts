/** Cor no formato #RRGGBB. */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Contraste mínimo do WCAG AA para texto normal. A cor principal aparece
 * como fundo de botões com texto branco e como texto sobre fundo branco, e
 * as duas situações têm a mesma razão de contraste.
 */
export const MIN_CONTRAST_RATIO = 4.5;

const WHITE = '#FFFFFF';

/** Luminância relativa (WCAG 2.x) de uma cor #RRGGBB. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores, de 1 a 21. */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** A cor tem contraste suficiente com o branco para ser a cor principal. */
export const hasAccessibleContrast = (hex: string): boolean =>
  contrastRatio(hex, WHITE) >= MIN_CONTRAST_RATIO;
