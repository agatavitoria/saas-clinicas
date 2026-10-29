# Modelo de dados

```mermaid
erDiagram
    clinics ||--|{ clinic_business_hours : "funciona em"
    clinics ||--o| clinic_brandings : "tem identidade visual"
    clinics ||--|{ users : "tem equipe"
    clinics ||--o{ refresh_tokens : "isola por tenant"
    users ||--o{ refresh_tokens : "tem sessões"
    clinics ||--o{ patients : "atende"
    patients ||--o{ patient_records : "tem prontuário"
    users ||--o{ patient_records : "registra"
    patient_records ||--o{ patient_records : "adendos"
    patients ||--o{ appointments : "é agendado"
    users ||--o{ appointments : "atende"
    platform_admins ||--o{ platform_refresh_tokens : "tem sessões"

    clinics {
        uuid id PK "é o tenantId das demais tabelas"
        string name
        string slug UK "subdomínio, fixo"
        string email
        string phone
        string document "CPF ou CNPJ, opcional"
        string timeZone "fuso IANA da agenda"
        int defaultAppointmentMinutes "duração sugerida"
        boolean active "inativa bloqueia toda a equipe"
        datetime deletionRequestedAt "LGPD: pedido do admin"
        uuid deletionRequestedById
        string deletionReason
        datetime deletionScheduledFor "LGPD: exclusão definitiva"
        datetime createdAt
        datetime updatedAt
    }

    clinic_brandings {
        uuid tenantId PK "também FK: uma linha por clínica"
        string primaryColor "#RRGGBB, opcional"
        bytes logo "PNG, JPEG ou WebP, até 512 KB"
        string logoMimeType
        datetime logoUpdatedAt "versão do logo, para o cache"
        datetime updatedAt
    }

    clinic_business_hours {
        uuid id PK
        uuid tenantId FK "único junto com weekday"
        int weekday "0 = domingo ... 6 = sábado"
        string opensAt "HH:mm"
        string closesAt "HH:mm"
    }

    users {
        uuid id PK
        uuid tenantId FK
        string name
        string email UK "único na plataforma (login)"
        string passwordHash "argon2id"
        enum roles "lista: ADMIN, PROFESSIONAL, RECEPTION"
        boolean active
        boolean mustChangePassword "senha provisória"
        datetime createdAt
        datetime updatedAt
    }

    refresh_tokens {
        uuid id PK
        uuid tenantId FK
        uuid userId FK
        string tokenHash UK "SHA-256 do token do cookie"
        datetime expiresAt
        datetime revokedAt "preenchido ao rotacionar ou sair"
        datetime createdAt
    }

    platform_admins {
        uuid id PK
        string name
        string email UK
        string passwordHash "argon2id"
        boolean active
        datetime createdAt
        datetime updatedAt
    }

    platform_refresh_tokens {
        uuid id PK
        uuid adminId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    patients {
        uuid id PK
        uuid tenantId FK "CPF único junto com tenantId"
        string name
        string socialName
        string cpf "somente dígitos"
        date birthDate
        enum gender
        string phone
        string email
        string emergencyContactName
        string emergencyContactPhone
        boolean active "inativado, nunca apagado"
    }

    patient_records {
        uuid id PK
        uuid tenantId FK
        uuid patientId FK
        uuid professionalId FK "quem atendeu"
        datetime occurredAt "data do atendimento"
        string notes "texto clínico"
        uuid amendsId FK "preenchido nos adendos"
        datetime createdAt
    }

    appointments {
        uuid id PK
        uuid tenantId FK
        uuid patientId FK
        uuid professionalId FK
        datetime startsAt
        datetime endsAt
        enum status "SCHEDULED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW"
        boolean outsideBusinessHours "encaixe"
        string notes "observação, não é prontuário"
        string cancelReason
        uuid createdById FK "quem marcou"
        datetime createdAt
        datetime updatedAt
    }

    audit_logs {
        uuid id PK
        uuid tenantId "sem FK: sobrevive à exclusão"
        enum actorType "USER, PLATFORM_ADMIN, SYSTEM"
        uuid actorId
        string actorLabel "nome no momento do evento"
        string action "ex.: user.deactivated"
        string targetType
        uuid targetId
        string targetLabel
        json metadata "sem dados pessoais"
        string ip "apagado após 180 dias"
        string userAgent
        datetime occurredAt
    }
```

Como ler o diagrama:

- **`clinics`** é o tenant. As outras tabelas da clínica apontam para ela pela
  coluna `tenantId`. Uma clínica com `active = false` bloqueia o acesso de toda
  a equipe.
- **`clinic_business_hours`** tem uma linha por dia de funcionamento. O par
  (`tenantId`, `weekday`) é único, então não há dois horários para o mesmo dia.
  Toda clínica tem pelo menos um dia.
- **`clinic_brandings`** guarda a cor principal e o logo, com no máximo uma
  linha por clínica. Fica separada de `clinics` para que os bytes do logo não
  sejam lidos em toda consulta da clínica. O formato do logo é conferido pelos
  primeiros bytes do arquivo, e não pelo `Content-Type`. SVG não é aceito,
  porque pode conter scripts.
- **`users`** é a equipe. Toda clínica tem pelo menos um administrador ativo:
  o sistema não deixa inativar o último.
- **`refresh_tokens`** guarda as sessões. Cada linha pertence a um usuário e
  também leva o `tenantId`, para ser filtrada pela clínica como as demais.
- **`platform_admins`** e **`platform_refresh_tokens`** são do admin master. Não
  têm `tenantId`, porque não pertencem a nenhuma clínica.
- **`patients`**: o par (`tenantId`, `cpf`) é único. O mesmo CPF pode existir
  em outra clínica, sem nenhum vínculo entre os cadastros, e um usuário de uma
  clínica pode ser paciente de outra. Pacientes são inativados, nunca
  apagados.
- **`patient_records`** é o prontuário. É **imutável**: não há edição nem
  exclusão, e o papel `app_tenant` só tem `SELECT` e `INSERT` nessa tabela.
  Correções e complementos são adendos, com `amendsId` apontando para o
  registro original.
- **`appointments`** é a agenda. Uma *exclusion constraint* (`btree_gist`)
  impede que o mesmo profissional tenha dois agendamentos sobrepostos entre os
  agendados, confirmados e realizados; cancelados e faltas liberam o horário.
  O intervalo é `[início, fim)`, então um termina às 09:00 e o seguinte começa
  às 09:00 sem conflito. Agendamentos são cancelados, nunca apagados (o papel
  `app_tenant` não tem `DELETE`).
- **`audit_logs`** só aceita inserção. Não tem chave estrangeira para a
  clínica, de propósito: quando uma clínica é excluída, os logs dela continuam,
  anonimizados, como prova do que aconteceu.
- Apagar uma clínica apaga em cascata todos os dados dela (`onDelete: Cascade`),
  exceto o log de auditoria.
