import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateScheduleSettingsDto } from './update-schedule-settings.dto.js';

const invalidFields = (payload: object) =>
  validateSync(plainToInstance(UpdateScheduleSettingsDto, payload)).map(
    (error) => error.property,
  );

describe('UpdateScheduleSettingsDto', () => {
  it('accepts a time zone and a duration', () => {
    expect(
      invalidFields({
        timeZone: 'America/Manaus',
        defaultAppointmentMinutes: 45,
      }),
    ).toEqual([]);
  });

  it('accepts partial updates', () => {
    expect(invalidFields({ timeZone: 'America/Sao_Paulo' })).toEqual([]);
    expect(invalidFields({ defaultAppointmentMinutes: 30 })).toEqual([]);
  });

  it.each(['Brasil', 'america/sao_paulo', 'GMT-3', ''])(
    'rejects the time zone %j',
    (timeZone) => {
      expect(invalidFields({ timeZone })).toEqual(['timeZone']);
    },
  );

  it.each([0, 4, 7, 245, 30.5, '30'])(
    'rejects the duration %j',
    (defaultAppointmentMinutes) => {
      expect(invalidFields({ defaultAppointmentMinutes })).toEqual([
        'defaultAppointmentMinutes',
      ]);
    },
  );
});
