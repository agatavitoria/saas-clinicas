export interface BusinessHour {
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  /** HH:mm */
  opensAt: string;
  /** HH:mm */
  closesAt: string;
}

export interface ZonedDateTime {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  /** HH:mm */
  time: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Data, dia da semana e horário de um instante no fuso informado. */
export function toZoned(instant: Date, timeZone: string): ZonedDateTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday],
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * O intervalo cabe inteiro no expediente de um único dia, no fuso da
 * clínica: começa depois da abertura e termina até o fechamento.
 */
export function isWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  hours: BusinessHour[],
  timeZone: string,
): boolean {
  const start = toZoned(startsAt, timeZone);
  const end = toZoned(endsAt, timeZone);
  if (start.date !== end.date) return false;

  const day = hours.find((hour) => hour.weekday === start.weekday);
  return Boolean(day && start.time >= day.opensAt && end.time <= day.closesAt);
}
