import { isValidCnpj, isValidCpf, isValidTaxId } from './tax-id.js';

describe('tax id validation', () => {
  it.each(['529.982.247-25', '52998224725'])('accepts valid CPF %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each(['529.982.247-24', '111.111.111-11', '123'])(
    'rejects invalid CPF %s',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );

  it.each(['11.222.333/0001-81', '11222333000181'])(
    'accepts valid CNPJ %s',
    (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true);
    },
  );

  it.each(['11.222.333/0001-80', '00.000.000/0000-00'])(
    'rejects invalid CNPJ %s',
    (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(false);
    },
  );

  it('accepts either CPF or CNPJ', () => {
    expect(isValidTaxId('52998224725')).toBe(true);
    expect(isValidTaxId('11222333000181')).toBe(true);
    expect(isValidTaxId('1234567890')).toBe(false);
  });
});
