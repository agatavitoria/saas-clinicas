// Mesma regra do backend (src/common/validation/tax-id.ts).

const allSameDigit = (digits: string): boolean => /^(\d)\1*$/.test(digits)

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

function isValidCpfDigits(digits: string): boolean {
  if (digits.length !== 11 || allSameDigit(digits)) return false
  return (
    checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[9])
    && checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[10])
  )
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || allSameDigit(digits)) return false
  return (
    checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12])
    && checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13])
  )
}

export function isValidTaxId(value: string): boolean {
  const digits = onlyDigits(value)
  return isValidCpfDigits(digits) || isValidCnpj(digits)
}

export function isValidCpf(value: string): boolean {
  return isValidCpfDigits(onlyDigits(value))
}
