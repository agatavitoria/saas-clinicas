import type { Appointment, AppointmentStatus } from '~/types/appointment'

interface StatusInfo {
  label: string
  color: string
  icon: string
}

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusInfo> = {
  SCHEDULED: { label: 'Agendado', color: 'primary', icon: 'mdi-calendar-clock' },
  CONFIRMED: { label: 'Confirmado', color: 'success', icon: 'mdi-calendar-check' },
  CANCELLED: { label: 'Cancelado', color: 'grey', icon: 'mdi-calendar-remove' },
  COMPLETED: { label: 'Realizado', color: 'info', icon: 'mdi-check-circle-outline' },
  NO_SHOW: { label: 'Faltou', color: 'error', icon: 'mdi-account-cancel-outline' },
}

/** Mesmas regras do backend (src/appointments/appointment-status.ts). */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
  CONFIRMED: ['CANCELLED', 'COMPLETED', 'NO_SHOW'],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
}

export const canTransition = (from: AppointmentStatus, to: AppointmentStatus) =>
  TRANSITIONS[from].includes(to)

export const isOpenAppointment = (appointment: Appointment) =>
  appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED'

export const hasStarted = (appointment: Appointment, now = new Date()) =>
  new Date(appointment.startsAt) <= now

/** Cancelados e faltas não ocupam o horário na grade. */
export const isInactiveAppointment = (appointment: Appointment) =>
  appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW'

export const durationMinutes = (appointment: Appointment) =>
  Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000)

/** "09:00 – 09:30" no fuso da clínica. */
export const appointmentTimeRange = (appointment: Appointment, timeZone: string) =>
  `${zonedClock(new Date(appointment.startsAt), timeZone).time} – ${zonedClock(new Date(appointment.endsAt), timeZone).time}`
