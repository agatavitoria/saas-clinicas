import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, hasRole } from '../auth/auth-user.js';
import {
  badRequest,
  conflict,
  forbidden,
  unprocessable,
} from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus, UserRole } from '../generated/prisma/enums.js';
import {
  PrismaService,
  type TenantTransactionClient,
} from '../prisma/prisma.service.js';
import {
  canTransition,
  isEditable,
  requiresStarted,
} from './appointment-status.js';
import {
  APPOINTMENT_SELECT,
  type AppointmentView,
  type ProfessionalOption,
} from './appointment.types.js';
import { isWithinBusinessHours } from './business-hours.js';
import type { ChangeStatusDto } from './dto/change-status.dto.js';
import type { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import type { ListAppointmentsDto } from './dto/list-appointments.dto.js';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto.js';

const MINUTE_MS = 60 * 1000;
const MAX_RANGE_MS = 31 * 24 * 60 * MINUTE_MS;
/** Tolerância para relógios levemente atrasados ao marcar "agora". */
const CLOCK_SKEW_MS = 5 * MINUTE_MS;
/** Nome da exclusion constraint da migration appointments. */
const NO_OVERLAP_CONSTRAINT = 'appointments_no_overlap';

const appointmentTarget = (appointment: AppointmentView) => ({
  type: 'Appointment',
  id: appointment.id,
  label: appointment.patient.name,
});

interface Slot {
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Agenda da clínica. Regras:
 * - recepção e admin marcam para qualquer profissional; o profissional só
 *   mexe na própria agenda;
 * - o mesmo profissional não tem dois horários sobrepostos (garantido pelo
 *   banco, mesmo com marcações simultâneas);
 * - fora do horário de funcionamento só com confirmação explícita (encaixe);
 * - cancelado, realizado e falta são finais; nada é apagado.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    tenantId: string,
    query: ListAppointmentsDto,
  ): Promise<AppointmentView[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const range = to.getTime() - from.getTime();
    if (range <= 0 || range > MAX_RANGE_MS) {
      throw badRequest(
        'INVALID_DATE_RANGE',
        '"to" must be after "from", at most 31 days apart',
      );
    }

    return this.prisma.forTenant(tenantId).appointment.findMany({
      where: {
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(query.professionalId
          ? { professionalId: query.professionalId }
          : {}),
        ...(query.patientId ? { patientId: query.patientId } : {}),
      },
      select: APPOINTMENT_SELECT,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }

  /** Usuários ativos com o papel de profissional, para escolher na agenda. */
  listProfessionals(tenantId: string): Promise<ProfessionalOption[]> {
    return this.prisma.forTenant(tenantId).user.findMany({
      where: { active: true, roles: { has: UserRole.PROFESSIONAL } },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    auth: AuthUser,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentView> {
    const slot = toSlot(dto.professionalId, dto.startsAt, dto.durationMinutes);
    assertCanManage(auth, slot.professionalId);
    assertNotInPast(slot.startsAt);

    return this.withOverlapConflict(() =>
      this.prisma.tenantTransaction(auth.tenantId, async (tx) => {
        const patient = await tx.patient.findUnique({
          where: { id: dto.patientId },
          select: { active: true },
        });
        if (!patient) throw new NotFoundException('Patient not found');
        if (!patient.active) {
          throw conflict(
            'PATIENT_INACTIVE',
            'Cannot schedule an inactive patient',
          );
        }
        await assertProfessional(tx, slot.professionalId);
        const outsideBusinessHours = await this.checkBusinessHours(
          tx,
          slot,
          dto.allowOutsideBusinessHours,
        );

        const appointment = await tx.appointment.create({
          data: {
            tenantId: auth.tenantId,
            patientId: dto.patientId,
            ...slot,
            outsideBusinessHours,
            notes: dto.notes ?? null,
            createdById: auth.userId,
          },
          select: APPOINTMENT_SELECT,
        });
        await this.audit.log(tx, 'appointment.created', {
          target: appointmentTarget(appointment),
          metadata: {
            professionalId: slot.professionalId,
            outsideBusinessHours,
          },
        });
        return appointment;
      }),
    );
  }

  /**
   * Remarca (profissional, início ou duração) e/ou altera a observação.
   * Remarcar volta o status para SCHEDULED: a confirmação era do horário antigo.
   */
  async update(
    auth: AuthUser,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentView> {
    return this.withOverlapConflict(() =>
      this.prisma.tenantTransaction(auth.tenantId, async (tx) => {
        const current = await findOrFail(tx, id);
        assertCanManage(auth, current.professional.id);
        if (!isEditable(current.status)) {
          throw conflict(
            'APPOINTMENT_NOT_EDITABLE',
            'Only scheduled or confirmed appointments can be changed',
          );
        }

        const currentMinutes = minutesBetween(current.startsAt, current.endsAt);
        const slot = toSlot(
          dto.professionalId ?? current.professional.id,
          dto.startsAt ?? current.startsAt.toISOString(),
          dto.durationMinutes ?? currentMinutes,
        );
        const rescheduled =
          slot.professionalId !== current.professional.id ||
          slot.startsAt.getTime() !== current.startsAt.getTime() ||
          slot.endsAt.getTime() !== current.endsAt.getTime();
        const notesChanged =
          dto.notes !== undefined && (dto.notes ?? null) !== current.notes;
        if (!rescheduled && !notesChanged) return current;

        const data: Prisma.AppointmentUpdateInput = {};
        if (notesChanged) data.notes = dto.notes ?? null;
        if (rescheduled) {
          assertCanManage(auth, slot.professionalId);
          assertNotInPast(slot.startsAt);
          if (slot.professionalId !== current.professional.id) {
            await assertProfessional(tx, slot.professionalId);
          }
          Object.assign(data, {
            professional: { connect: { id: slot.professionalId } },
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            status: AppointmentStatus.SCHEDULED,
            outsideBusinessHours: await this.checkBusinessHours(
              tx,
              slot,
              dto.allowOutsideBusinessHours,
            ),
          });
        }

        const appointment = await tx.appointment.update({
          where: { id },
          data,
          select: APPOINTMENT_SELECT,
        });
        const fields = [
          ...(slot.professionalId !== current.professional.id
            ? ['professional']
            : []),
          ...(slot.startsAt.getTime() !== current.startsAt.getTime()
            ? ['startsAt']
            : []),
          ...(slot.endsAt.getTime() - slot.startsAt.getTime() !==
          currentMinutes * MINUTE_MS
            ? ['duration']
            : []),
          ...(notesChanged ? ['notes'] : []),
        ];
        await this.audit.log(
          tx,
          rescheduled ? 'appointment.rescheduled' : 'appointment.updated',
          {
            target: appointmentTarget(appointment),
            metadata: {
              fields,
              ...(rescheduled
                ? {
                    professionalId: slot.professionalId,
                    outsideBusinessHours: appointment.outsideBusinessHours,
                  }
                : {}),
            },
          },
        );
        return appointment;
      }),
    );
  }

  async changeStatus(
    auth: AuthUser,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<AppointmentView> {
    if (dto.cancelReason && dto.status !== AppointmentStatus.CANCELLED) {
      throw badRequest(
        'INVALID_STATUS_TRANSITION',
        'cancelReason is only allowed when cancelling',
      );
    }

    return this.prisma.tenantTransaction(auth.tenantId, async (tx) => {
      const current = await findOrFail(tx, id);
      assertCanManage(auth, current.professional.id);
      if (!canTransition(current.status, dto.status)) {
        throw conflict(
          'INVALID_STATUS_TRANSITION',
          `Cannot change an appointment from ${current.status} to ${dto.status}`,
        );
      }
      if (requiresStarted(dto.status) && current.startsAt > new Date()) {
        throw conflict(
          'APPOINTMENT_NOT_STARTED',
          'Completed and no-show require the appointment to have started',
        );
      }

      const appointment = await tx.appointment.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === AppointmentStatus.CANCELLED
            ? { cancelReason: dto.cancelReason ?? null }
            : {}),
        },
        select: APPOINTMENT_SELECT,
      });
      // O motivo do cancelamento é texto livre: não vai para o log
      await this.audit.log(tx, 'appointment.status_changed', {
        target: appointmentTarget(appointment),
        metadata: { status: { from: current.status, to: dto.status } },
      });
      return appointment;
    });
  }

  /**
   * Devolve se o horário fica fora do funcionamento. Nesse caso, só aceita
   * com a confirmação explícita do encaixe.
   */
  private async checkBusinessHours(
    tx: TenantTransactionClient,
    slot: Slot,
    allowOutside = false,
  ): Promise<boolean> {
    const clinic = await tx.clinic.findFirstOrThrow({
      select: {
        timeZone: true,
        businessHours: {
          select: { weekday: true, opensAt: true, closesAt: true },
        },
      },
    });
    const outside = !isWithinBusinessHours(
      slot.startsAt,
      slot.endsAt,
      clinic.businessHours,
      clinic.timeZone,
    );
    if (outside && !allowOutside) {
      throw unprocessable(
        'OUTSIDE_BUSINESS_HOURS',
        'The appointment is outside business hours; confirm to book it anyway',
      );
    }
    return outside;
  }

  private async withOverlapConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isOverlapViolation(error)) {
        throw conflict(
          'APPOINTMENT_CONFLICT',
          'The professional already has an appointment at this time',
        );
      }
      throw error;
    }
  }
}

function toSlot(
  professionalId: string,
  startsAt: string,
  durationMinutes: number,
): Slot {
  const start = new Date(startsAt);
  return {
    professionalId,
    startsAt: start,
    endsAt: new Date(start.getTime() + durationMinutes * MINUTE_MS),
  };
}

const minutesBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / MINUTE_MS);

/** Recepção e admin mexem em qualquer agenda; o profissional, só na própria. */
function assertCanManage(auth: AuthUser, professionalId: string): void {
  if (hasRole(auth, UserRole.ADMIN, UserRole.RECEPTION)) return;
  if (professionalId !== auth.userId) {
    throw forbidden(
      'NOT_OWN_APPOINTMENT',
      'Professionals can only manage their own appointments',
    );
  }
}

function assertNotInPast(startsAt: Date): void {
  if (startsAt.getTime() < Date.now() - CLOCK_SKEW_MS) {
    throw badRequest(
      'APPOINTMENT_IN_PAST',
      'Appointments cannot be booked in the past',
    );
  }
}

async function assertProfessional(
  tx: TenantTransactionClient,
  professionalId: string,
): Promise<void> {
  const professional = await tx.user.findFirst({
    where: {
      id: professionalId,
      active: true,
      roles: { has: UserRole.PROFESSIONAL },
    },
    select: { id: true },
  });
  if (!professional) {
    throw badRequest(
      'INVALID_PROFESSIONAL',
      'The professional must be an active user with the PROFESSIONAL role',
    );
  }
}

async function findOrFail(
  tx: TenantTransactionClient,
  id: string,
): Promise<AppointmentView> {
  const appointment = await tx.appointment.findUnique({
    where: { id },
    select: APPOINTMENT_SELECT,
  });
  if (!appointment) throw new NotFoundException('Appointment not found');
  return appointment;
}

/** Violação da exclusion constraint (SQLSTATE 23P01) de sobreposição. */
function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const details = JSON.stringify({
    message: error.message,
    meta: (error as { meta?: unknown }).meta,
    cause: (error as { cause?: unknown }).cause,
  });
  return details.includes(NO_OVERLAP_CONSTRAINT) || details.includes('23P01');
}
