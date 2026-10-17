const onlyDigits = (value: string): string => value.replace(/\D/g, '');

const allSameDigit = (digits: string): boolean => /^(\d)\1*$/.test(digits);

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce(
    (acc, weight, index) => acc + Number(digits[index]) * weight,
    0,
  );
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) return false;

  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) return false;

  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos), com ou sem máscara. */
export function isValidTaxId(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value);
}
