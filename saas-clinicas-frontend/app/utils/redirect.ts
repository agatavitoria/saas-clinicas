/**
 * Destino seguro após o login: só caminhos internos, para evitar open
 * redirect (ex.: ?redirect=//site-malicioso.com).
 */
export function safeRedirect(value: unknown, fallback = '/painel'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}
