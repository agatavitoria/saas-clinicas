-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "defaultAppointmentMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- Mesmos limites do UpdateScheduleSettingsDto
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_defaultAppointmentMinutes_check"
  CHECK ("defaultAppointmentMinutes" BETWEEN 5 AND 240);
