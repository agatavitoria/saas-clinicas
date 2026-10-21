export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** (11) 3333-4444 ou (11) 99999-8888 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''

  const area = digits.slice(0, 2)
  const number = digits.slice(2)
  const splitAt = digits.length === 11 ? 5 : 4
  const head = number.slice(0, splitAt)
  const tail = number.slice(splitAt)
  return tail ? `(${area}) ${head}-${tail}` : `(${area}) ${head}`
}

/** CPF 000.000.000-00 (no máximo 11 dígitos). */
export function formatCpf(value: string): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** CPF 000.000.000-00 ou CNPJ 00.000.000/0000-00, conforme a quantidade de dígitos. */
export function formatTaxId(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
