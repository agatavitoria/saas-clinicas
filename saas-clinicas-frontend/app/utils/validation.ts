/** Regras no formato esperado pela prop `rules` dos campos do Vuetify. */
export type ValidationRule = (value: unknown) => true | string

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const asText = (value: unknown): string => (value == null ? '' : String(value))

export const formRules = {
  required:
    (message = 'Campo obrigatório'): ValidationRule =>
    value => asText(value).trim() !== '' || message,

  minLength:
    (min: number): ValidationRule =>
    value => asText(value).trim().length >= min || `Mínimo de ${min} caracteres`,

  email: (value: unknown) =>
    !asText(value) || EMAIL_PATTERN.test(asText(value).trim()) || 'Informe um e-mail válido',

  phone: (value: unknown) =>
    !asText(value)
    || [10, 11].includes(onlyDigits(asText(value)).length)
    || 'Informe o DDD e o número',

  taxId: (value: unknown) =>
    !asText(value) || isValidTaxId(asText(value)) || 'CPF ou CNPJ inválido',

  cpf: (value: unknown) => isValidCpf(asText(value)) || 'CPF inválido',

  /** Data YYYY-MM-DD (campo type="date"), não futura. */
  pastDate: (value: unknown) => {
    const text = asText(value)
    if (!text) return true
    const date = new Date(`${text}T00:00:00`)
    return (!Number.isNaN(date.getTime()) && date <= new Date()) || 'Informe uma data válida, que não seja futura'
  },

  time: (value: unknown) => TIME_PATTERN.test(asText(value)) || 'Horário inválido',

  slug: (value: unknown) =>
    isValidSlug(asText(value).trim())
    || `Use de ${SLUG_MIN_LENGTH} a ${SLUG_MAX_LENGTH} letras minúsculas, números ou hífens (sem hífen nas pontas)`,

  sameAs:
    (other: () => string, message: string): ValidationRule =>
    value => asText(value) === other() || message,
} satisfies Record<string, unknown>
