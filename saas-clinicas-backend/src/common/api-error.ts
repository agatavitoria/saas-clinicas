import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Códigos de erro estáveis que o frontend usa para escolher a mensagem
 * exibida (os textos da API ficam em inglês).
 */
export type ApiErrorCode =
  | 'USER_INACTIVE'
  | 'CLINIC_INACTIVE'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'EMAIL_IN_USE'
  | 'CANNOT_DEACTIVATE_SELF'
  | 'LAST_ACTIVE_ADMIN'
  | 'SAME_PASSWORD'
  | 'INVALID_CURRENT_PASSWORD'
  | 'CLINIC_READ_ONLY'
  | 'INVALID_DELETION_STATE'
  | 'CONFIRMATION_MISMATCH'
  | 'CPF_IN_USE'
  | 'PATIENT_INACTIVE'
  | 'INVALID_AMENDMENT'
  | 'NOT_RECORD_AUTHOR'
  | 'CANNOT_REMOVE_OWN_ADMIN'
  | 'LOW_COLOR_CONTRAST'
  | 'INVALID_LOGO'
  | 'LOGO_TOO_LARGE'
  | 'SLUG_RESERVED'
  | 'SLUG_TAKEN'
  | 'CLINIC_NOT_FOUND'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_PROFESSIONAL'
  | 'APPOINTMENT_CONFLICT'
  | 'OUTSIDE_BUSINESS_HOURS'
  | 'APPOINTMENT_IN_PAST'
  | 'APPOINTMENT_NOT_STARTED'
  | 'APPOINTMENT_NOT_EDITABLE'
  | 'INVALID_STATUS_TRANSITION'
  | 'NOT_OWN_APPOINTMENT';

type ExceptionClass = new (body: object) => HttpException;

function apiError(
  Exception: ExceptionClass,
  status: number,
  code: ApiErrorCode,
  message: string,
): HttpException {
  return new Exception({ statusCode: status, code, message });
}

export const forbidden = (code: ApiErrorCode, message: string) =>
  apiError(ForbiddenException, 403, code, message);

export const conflict = (code: ApiErrorCode, message: string) =>
  apiError(ConflictException, 409, code, message);

export const badRequest = (code: ApiErrorCode, message: string) =>
  apiError(BadRequestException, 400, code, message);

export const notFound = (code: ApiErrorCode, message: string) =>
  apiError(NotFoundException, 404, code, message);

/** Pedido válido, mas que precisa de confirmação do usuário (ex.: encaixe). */
export const unprocessable = (code: ApiErrorCode, message: string) =>
  apiError(UnprocessableEntityException, 422, code, message);
