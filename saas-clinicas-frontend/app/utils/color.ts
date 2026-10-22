/** Cor principal padrão do sistema (também usada no plugin do Vuetify). */
export const DEFAULT_PRIMARY_COLOR = '#00696B'

/** Mesma regra do backend (src/common/color.ts): WCAG AA para texto normal. */
export const MIN_CONTRAST_RATIO = 4.5

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

/** Sugestões de cor principal; todas têm contraste suficiente com o branco. */
export const BRAND_PALETTE = [
  { value: DEFAULT_PRIMARY_COLOR, label: 'Verde-azulado (padrão)' },
  { value: '#1565C0', label: 'Azul' },
  { value: '#3949AB', label: 'Índigo' },
  { value: '#5E35B1', label: 'Roxo' },
  { value: '#AD1457', label: 'Rosa' },
  { value: '#C62828', label: 'Vermelho' },
  { value: '#A65200', label: 'Laranja' },
  { value: '#2E7D32', label: 'Verde' },
  { value: '#6D4C41', label: 'Marrom' },
  { value: '#455A64', label: 'Grafite' },
]

function relativeLuminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste da cor com o branco, de 1 a 21. */
export const contrastWithWhite = (hex: string): number =>
  1.05 / (relativeLuminance(hex) + 0.05)

/** 6.5 → "6,5:1" */
export const formatContrast = (ratio: number): string =>
  `${ratio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}:1`
