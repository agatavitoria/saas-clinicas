/** Sem caracteres ambíguos (0/O, 1/l/I), para ditar ou copiar sem erro. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const MIN_PASSWORD_LENGTH = 8

/** Senha provisória aleatória (usa o gerador criptográfico do navegador). */
export function generateTemporaryPassword(length = 12): string {
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, value => ALPHABET[value % ALPHABET.length]).join('')
}
