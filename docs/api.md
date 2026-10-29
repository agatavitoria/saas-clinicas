# API (guia de rotas)

Para testar no Insomnia, importe a coleção em [`insomnia/`](../insomnia/README.md),
que traz todas as rotas e um roteiro de uso.

Todas as rotas ficam sob o prefixo `/api`. Os erros de regra de negócio
trazem um `code` estável (por exemplo, `EMAIL_IN_USE` ou `USER_INACTIVE`),
que o frontend traduz para uma mensagem em português.

**Clínica**

| Método | Rota                              | Acesso       | Descrição                                   |
| ------ | --------------------------------- | ------------ | ------------------------------------------- |
| GET    | `/api/health`                     | pública      | checagem de saúde                           |
| GET    | `/api/public/clinics/:slug`       | pública      | nome, cor e `logoUpdatedAt` para o login    |
| GET    | `/api/public/clinics/:slug/logo`  | pública      | imagem do logo para o login                 |
| POST   | `/api/auth/login`                 | pública      | login (`{ email, password }` + header `X-Clinic-Slug`) |
| POST   | `/api/auth/refresh`               | pública      | renova a sessão a partir do `refresh_token` |
| POST   | `/api/auth/logout`                | pública      | encerra a sessão e limpa os cookies         |
| GET    | `/api/auth/me`                    | logado       | usuário logado, com `mustChangePassword` e `branding` |
| POST   | `/api/auth/change-password`       | logado       | `{ currentPassword, newPassword }`          |
| GET    | `/api/clinics/me`                 | logado       | dados, horários e `branding` da clínica     |
| PATCH  | `/api/clinics/me`                 | `ADMIN`      | `{ name }`: renomeia a clínica              |
| GET    | `/api/clinics/me/logo`            | logado       | imagem do logo (use `?v=<logoUpdatedAt>`)   |
| PATCH  | `/api/clinics/me/schedule-settings` | `ADMIN`    | `{ timeZone?, defaultAppointmentMinutes? }`: fuso IANA e duração padrão |
| PUT    | `/api/clinics/me/business-hours`  | `ADMIN`      | `{ businessHours }`: substitui a semana (dias ausentes = fechado) |
| PATCH  | `/api/clinics/me/branding`        | `ADMIN`      | `{ primaryColor }` (`#RRGGBB` ou `null`)    |
| PUT    | `/api/clinics/me/branding/logo`   | `ADMIN`      | corpo = a imagem, `Content-Type: image/*`   |
| DELETE | `/api/clinics/me/branding/logo`   | `ADMIN`      | remove o logo                               |
| GET    | `/api/users`                      | logado       | equipe da clínica                           |
| POST   | `/api/users`                      | `ADMIN`      | cria usuário com senha provisória           |
| PATCH  | `/api/users/:id/status`           | `ADMIN`      | `{ active }`: inativa ou reativa            |
| PATCH  | `/api/users/:id/roles`            | `ADMIN`      | `{ roles }`: define os papéis (pelo menos um) |
| POST   | `/api/users/:id/reset-password`   | `ADMIN`      | `{ temporaryPassword }`                     |
| GET    | `/api/patients`                   | logado       | busca (`search`), `status` e paginação      |
| POST   | `/api/patients`                   | `RECEPTION`, `ADMIN` | cadastra paciente                   |
| GET    | `/api/patients/:id`               | logado       | ficha (registra `patient.viewed`)           |
| PATCH  | `/api/patients/:id`               | `RECEPTION`, `ADMIN` | edição parcial                      |
| PATCH  | `/api/patients/:id/status`        | `RECEPTION`, `ADMIN` | `{ active }`                        |
| GET    | `/api/patients/:id/records`       | logado       | atendimentos com adendos (`professionalId`) |
| POST   | `/api/patients/:id/records`       | `PROFESSIONAL`, `ADMIN` | `{ notes, occurredAt? }`         |
| POST   | `/api/patients/:id/records/:recordId/amendments` | autor ou `ADMIN` | `{ notes }`             |
| GET    | `/api/professionals`              | logado       | profissionais ativos (para a agenda)        |
| GET    | `/api/appointments`               | logado       | `from`, `to` (até 31 dias), `professionalId?`, `patientId?` |
| POST   | `/api/appointments`               | recepção, admin ou o próprio profissional | `{ patientId, professionalId, startsAt, durationMinutes, notes?, allowOutsideBusinessHours? }` |
| PATCH  | `/api/appointments/:id`           | idem         | remarca e/ou altera a observação            |
| PATCH  | `/api/appointments/:id/status`    | idem         | `{ status, cancelReason? }`                 |
| GET    | `/api/audit-logs`                 | `ADMIN`      | histórico da clínica (filtros e cursor)     |
| GET    | `/api/clinics/me/export`          | `ADMIN`      | exportação dos dados (JSON)                 |
| POST   | `/api/clinics/me/deletion-request` | `ADMIN`     | `{ confirmationName, reason? }`             |
| DELETE | `/api/clinics/me/deletion-request` | `ADMIN`     | cancela o pedido ou a exclusão agendada     |

**Admin master**

| Método | Rota                                                | Descrição                                   |
| ------ | --------------------------------------------------- | ------------------------------------------- |
| POST   | `/api/platform/auth/login` · `refresh` · `logout`  | sessão do master (login/refresh/logout públicos) |
| GET    | `/api/platform/auth/me`                             | admin logado                                |
| GET    | `/api/platform/clinics`                             | todas as clínicas, com número de usuários   |
| POST   | `/api/platform/clinics`                             | cria clínica + administrador                |
| GET    | `/api/platform/clinics/:id`                         | dados e horários                            |
| PATCH  | `/api/platform/clinics/:id`                         | `{ name }`: renomeia a clínica              |
| PATCH  | `/api/platform/clinics/:id/status`                  | `{ active }`: inativar derruba toda a equipe |
| GET    | `/api/platform/clinics/:id/logo`                    | imagem do logo                              |
| PATCH  | `/api/platform/clinics/:id/branding`                | `{ primaryColor }`                          |
| PUT    | `/api/platform/clinics/:id/branding/logo`           | envia o logo (corpo = a imagem)             |
| DELETE | `/api/platform/clinics/:id/branding/logo`           | remove o logo                               |
| GET    | `/api/platform/clinics/:id/users`                   | equipe da clínica                           |
| POST   | `/api/platform/clinics/:id/users`                   | cria usuário                                |
| PATCH  | `/api/platform/clinics/:id/users/:userId/status`    | inativa ou reativa                          |
| PATCH  | `/api/platform/clinics/:id/users/:userId/roles`     | define os papéis                            |
| POST   | `/api/platform/clinics/:id/users/:userId/reset-password` | nova senha provisória                  |
| GET    | `/api/platform/audit-logs`                          | histórico de toda a plataforma (filtro `tenantId`) |
| GET    | `/api/platform/clinics/:id/audit-logs`              | histórico de uma clínica                    |
| GET    | `/api/platform/clinics/:id/export`                  | exportação dos dados (JSON)                 |
| POST   | `/api/platform/clinics/:id/deletion/confirm`        | confirma o pedido: exclusão em 30 dias      |
| POST   | `/api/platform/clinics/:id/deletion/reject`         | recusa o pedido                             |
| POST   | `/api/platform/clinics/:id/deletion/cancel`         | cancela durante a carência e reativa        |

Os históricos aceitam os filtros `action`, `actorId`, `from`, `to`, `limit`
(até 100) e `cursor`. Para buscar a página seguinte, passe como `cursor` o
`nextCursor` da página anterior.

## Agendamentos

- `startsAt` precisa ter fuso explícito (`2026-11-02T09:00:00-03:00` ou
  `...Z`). O expediente é conferido no fuso da clínica.
- A duração vai de 5 a 480 minutos, em múltiplos de 5.
- Status: todo agendamento nasce `SCHEDULED`. Daí pode ir para `CONFIRMED`,
  `CANCELLED`, `COMPLETED` ou `NO_SHOW`; de `CONFIRMED`, para os três
  últimos. Os três últimos são finais. `COMPLETED` e `NO_SHOW` só valem a
  partir do horário marcado.
- Remarcar (profissional, início ou duração) só vale para agendamentos em
  aberto e volta o status para `SCHEDULED`.

| Código                      | Status | Quando                                              |
| --------------------------- | :----: | --------------------------------------------------- |
| `APPOINTMENT_CONFLICT`      | 409    | o profissional já tem agendamento no horário        |
| `OUTSIDE_BUSINESS_HOURS`    | 422    | fora do funcionamento; reenvie com `allowOutsideBusinessHours: true` para marcar o encaixe |
| `APPOINTMENT_IN_PAST`       | 400    | início no passado                                   |
| `INVALID_PROFESSIONAL`      | 400    | usuário inativo ou sem o papel `PROFESSIONAL`       |
| `PATIENT_INACTIVE`          | 409    | paciente inativado                                  |
| `INVALID_STATUS_TRANSITION` | 409    | mudança de status não permitida                     |
| `APPOINTMENT_NOT_STARTED`   | 409    | realizado ou falta antes do horário                 |
| `APPOINTMENT_NOT_EDITABLE`  | 409    | remarcar um agendamento finalizado                  |
| `NOT_OWN_APPOINTMENT`       | 403    | profissional mexendo na agenda de outro             |
| `INVALID_DATE_RANGE`        | 400    | período da listagem invertido ou maior que 31 dias  |

## `POST /api/platform/clinics`

Cria a clínica, os horários de funcionamento e o usuário administrador numa
única operação.

```json
{
  "clinic": {
    "name": "Clínica Sorriso",
    "slug": "sorriso",
    "email": "contato@sorriso.com",
    "phone": "11999998888",
    "document": "11222333000181"
  },
  "businessHours": [
    { "weekday": 1, "opensAt": "08:00", "closesAt": "18:00" }
  ],
  "admin": {
    "name": "Ana Souza",
    "email": "ana@sorriso.com",
    "temporaryPassword": "provisoria-123"
  }
}
```

- `weekday` vai de `0` (domingo) a `6` (sábado), e é preciso pelo menos um dia.
- `slug` é o subdomínio: de 3 a 63 letras minúsculas, números ou hífens (sem
  hífen nas pontas). Não pode ser alterado depois.
- `document` (CPF ou CNPJ) é opcional.
- O administrador é criado com `mustChangePassword: true`.
- Respostas: `201` com a clínica e o administrador (sem a senha); `400` para
  dados inválidos ou `SLUG_RESERVED` para um endereço reservado; `409`
  (`EMAIL_IN_USE`) se o e-mail do administrador já estiver em uso, ou
  (`SLUG_TAKEN`) se o endereço já for de outra clínica.
