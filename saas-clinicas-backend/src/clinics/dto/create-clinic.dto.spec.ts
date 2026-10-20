import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateClinicDto } from './create-clinic.dto.js';

const validPayload = () => ({
  clinic: {
    name: '  Clínica Sorriso  ',
    email: ' Contato@Sorriso.COM ',
    phone: '(11) 99999-8888',
    document: '11.222.333/0001-81',
  },
  businessHours: [
    { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
    { weekday: 2, opensAt: '08:00', closesAt: '12:00' },
  ],
  admin: {
    name: 'Ana Souza',
    email: 'ANA@sorriso.com',
    temporaryPassword: 'senha-segura',
  },
});

function validate(payload: unknown) {
  const dto = plainToInstance(CreateClinicDto, payload);
  return { dto, errors: validateSync(dto) };
}

/** Caminhos das propriedades inválidas, ex.: "clinic.phone". */
function errorPaths(payload: unknown): string[] {
  const walk = (
    errors: ReturnType<typeof validateSync>,
    prefix = '',
  ): string[] =>
    errors.flatMap((error) => {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      return error.children?.length ? walk(error.children, path) : [path];
    });
  return walk(validate(payload).errors);
}

describe('CreateClinicDto', () => {
  it('accepts a valid payload and normalizes fields', () => {
    const { dto, errors } = validate(validPayload());

    expect(errors).toHaveLength(0);
    expect(dto.clinic.name).toBe('Clínica Sorriso');
    expect(dto.clinic.email).toBe('contato@sorriso.com');
    expect(dto.clinic.phone).toBe('11999998888');
    expect(dto.clinic.document).toBe('11222333000181');
    expect(dto.admin.email).toBe('ana@sorriso.com');
  });

  it('accepts a clinic without document', () => {
    const payload = validPayload();
    delete (payload.clinic as { document?: string }).document;

    expect(errorPaths(payload)).toEqual([]);
  });

  it('rejects an invalid CPF/CNPJ', () => {
    const payload = validPayload();
    payload.clinic.document = '11.222.333/0001-80';

    expect(errorPaths(payload)).toEqual(['clinic.document']);
  });

  it('rejects a phone without area code', () => {
    const payload = validPayload();
    payload.clinic.phone = '99999-8888';

    expect(errorPaths(payload)).toEqual(['clinic.phone']);
  });

  it('rejects closing time before opening time', () => {
    const payload = validPayload();
    payload.businessHours[0].closesAt = '07:00';

    expect(errorPaths(payload)).toEqual(['businessHours.0.closesAt']);
  });

  it('rejects malformed times', () => {
    const payload = validPayload();
    payload.businessHours[0].opensAt = '8h';

    expect(errorPaths(payload)).toContain('businessHours.0.opensAt');
  });

  it('rejects repeated weekdays', () => {
    const payload = validPayload();
    payload.businessHours[1].weekday = 1;

    expect(errorPaths(payload)).toEqual(['businessHours']);
  });

  it('requires at least one business day', () => {
    const payload = { ...validPayload(), businessHours: [] };

    expect(errorPaths(payload)).toEqual(['businessHours']);
  });

  it('rejects a short password', () => {
    const payload = validPayload();
    payload.admin.temporaryPassword = '1234567';

    expect(errorPaths(payload)).toEqual(['admin.temporaryPassword']);
  });
});
