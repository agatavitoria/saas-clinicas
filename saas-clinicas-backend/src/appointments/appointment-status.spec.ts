import { AppointmentStatus } from '../generated/prisma/enums.js';
import {
  canTransition,
  isEditable,
  requiresStarted,
} from './appointment-status.js';

const { SCHEDULED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW } =
  AppointmentStatus;

describe('appointment status', () => {
  it.each([
    [SCHEDULED, CONFIRMED],
    [SCHEDULED, CANCELLED],
    [SCHEDULED, COMPLETED],
    [SCHEDULED, NO_SHOW],
    [CONFIRMED, CANCELLED],
    [CONFIRMED, COMPLETED],
    [CONFIRMED, NO_SHOW],
  ])('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [CONFIRMED, SCHEDULED],
    [CONFIRMED, CONFIRMED],
    [CANCELLED, SCHEDULED],
    [CANCELLED, CONFIRMED],
    [COMPLETED, NO_SHOW],
    [NO_SHOW, COMPLETED],
    [COMPLETED, CANCELLED],
  ])('refuses %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('only open appointments can be rescheduled', () => {
    expect(isEditable(SCHEDULED)).toBe(true);
    expect(isEditable(CONFIRMED)).toBe(true);
    for (const status of [CANCELLED, COMPLETED, NO_SHOW]) {
      expect(isEditable(status)).toBe(false);
    }
  });

  it('completed and no-show require the appointment to have started', () => {
    expect(requiresStarted(COMPLETED)).toBe(true);
    expect(requiresStarted(NO_SHOW)).toBe(true);
    expect(requiresStarted(CONFIRMED)).toBe(false);
    expect(requiresStarted(CANCELLED)).toBe(false);
  });
});
