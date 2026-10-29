import { isWithinBusinessHours, toZoned } from './business-hours.js';

const SAO_PAULO = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';
/** Segunda 08:00–18:00 e quarta 08:00–12:00 */
const HOURS = [
  { weekday: 1, opensAt: '08:00', closesAt: '18:00' },
  { weekday: 3, opensAt: '08:00', closesAt: '12:00' },
];

/** 2026-11-02 é uma segunda-feira; São Paulo está em UTC-3. */
const at = (iso: string) => new Date(iso);

describe('toZoned', () => {
  it('converts an instant to the local date, weekday and time', () => {
    expect(toZoned(at('2026-11-02T11:30:00Z'), SAO_PAULO)).toEqual({
      date: '2026-11-02',
      weekday: 1,
      time: '08:30',
    });
  });

  it('crosses the day boundary', () => {
    // 01:00 UTC de terça ainda é 22:00 de segunda em São Paulo
    expect(toZoned(at('2026-11-03T01:00:00Z'), SAO_PAULO)).toEqual({
      date: '2026-11-02',
      weekday: 1,
      time: '22:00',
    });
  });
});

describe('isWithinBusinessHours', () => {
  const check = (start: string, end: string, timeZone = SAO_PAULO) =>
    isWithinBusinessHours(at(start), at(end), HOURS, timeZone);

  it('accepts an appointment inside the opening hours', () => {
    expect(check('2026-11-02T11:00:00Z', '2026-11-02T11:30:00Z')).toBe(true);
  });

  it('accepts the exact opening and closing times', () => {
    expect(check('2026-11-02T11:00:00Z', '2026-11-02T21:00:00Z')).toBe(true);
  });

  it('rejects starting before opening or ending after closing', () => {
    expect(check('2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z')).toBe(false);
    expect(check('2026-11-02T20:45:00Z', '2026-11-02T21:15:00Z')).toBe(false);
  });

  it('rejects a closed day', () => {
    // Terça
    expect(check('2026-11-03T12:00:00Z', '2026-11-03T12:30:00Z')).toBe(false);
  });

  it('uses the shorter hours of each weekday', () => {
    // Quarta fecha às 12:00
    expect(check('2026-11-04T14:30:00Z', '2026-11-04T15:00:00Z')).toBe(true);
    expect(check('2026-11-04T14:45:00Z', '2026-11-04T15:15:00Z')).toBe(false);
  });

  it('rejects appointments that cross midnight', () => {
    expect(check('2026-11-03T02:30:00Z', '2026-11-03T03:30:00Z')).toBe(false);
  });

  it('follows the clinic time zone', () => {
    // 12:30 UTC: 09:30 em São Paulo, 08:30 em Manaus
    expect(check('2026-11-02T12:30:00Z', '2026-11-02T13:00:00Z', MANAUS)).toBe(
      true,
    );
    // 11:30 UTC: 08:30 em São Paulo, mas 07:30 em Manaus
    expect(check('2026-11-02T11:30:00Z', '2026-11-02T12:00:00Z', MANAUS)).toBe(
      false,
    );
  });
});
