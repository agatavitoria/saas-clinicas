# SaaS Clínicas

Sistema de agenda e gestão para clínicas pequenas e consultórios, no modelo
SaaS multi-tenant: cada clínica tem seus próprios usuários, pacientes e
agenda, e nunca enxerga dados de outra clínica.

> Projeto de estudo desenvolvido com padrão de qualidade profissional:
> código limpo, testado e bem estruturado.

## Funcionalidades

**Disponível**

- **Endereço por clínica:** cada clínica tem um subdomínio próprio
  (`sorriso.dominio.com`), definido na criação e fixo depois. O login já
  abre com o nome, a cor e o logo dela, e só aceita usuários daquela clínica.
  O master fica em `admin.dominio.com`, e o domínio raiz só pergunta o
  endereço da clínica.
- **Admin master (plataforma)**, em `admin.<domínio>/master`:
  - cria clínicas (dados, endereço, horário de funcionamento e administrador);
  - lista, ativa e inativa clínicas;
  - cadastra, inativa e redefine a senha dos usuários de qualquer clínica.
- **Administrador da clínica**, em `/painel/equipe`:
  - cadastra usuários da própria clínica;
  - inativa e reativa usuários;
  - redefine senhas.
- **Senha provisória:** todo usuário novo, ou com senha redefinida, entra com
  uma senha provisória e é obrigado a trocá-la no primeiro acesso.
- **Login** com sessão em cookies httpOnly, renovação automática e logout.
  Inativar um usuário ou uma clínica derruba o acesso na hora.
- **Painel da clínica:** dados de contato, status "aberta agora", horário da
  semana e equipe.
- **Pacientes**, em `/painel/pacientes`:
  - cadastro com busca por nome ou CPF. O CPF é único dentro da clínica, e o
    mesmo CPF em outra clínica é um cadastro independente;
  - ficha do paciente;
  - **prontuário**: registros de atendimento imutáveis, com adendos para
    correções.
- **Agenda**, em `/painel/agenda`:
  - visão de dia (uma coluna por profissional) e de semana, com o horário de
    funcionamento em destaque e a linha do "agora";
  - agendamento com paciente, profissional, data, hora e duração (sugerida
    pela duração padrão da clínica). Clicar num horário vazio já preenche o
    profissional e a hora;
  - o mesmo profissional nunca tem dois horários sobrepostos (trava no banco,
    vale também para marcações simultâneas);
  - fora do horário de funcionamento, a tela avisa e permite marcar como
    **encaixe**;
  - status: agendado, confirmado, cancelado (com motivo), realizado e faltou.
    Remarcar volta para "agendado";
  - horários sempre no fuso da clínica, configurável em `/painel/clinica`.
- **Auditoria:** histórico imutável de quem fez o quê e quando. O admin vê o
  da própria clínica, em `/painel/atividades`; o master vê o de toda a
  plataforma, em `/master/atividades`.
- **LGPD:**
  - exportação de todos os dados da clínica;
  - exclusão em duas etapas (o admin solicita e o master confirma), com 30
    dias de carência. Nesse período o sistema fica somente para consulta,
    mostra quantos dias faltam e o admin pode cancelar. Depois, o histórico é
    mantido de forma anônima;
  - IP apagado dos logs depois de 180 dias.
- **Personalização**, em `/painel/clinica` (admin) e na clínica em `/master`:
  - nome da clínica;
  - cor principal escolhida numa paleta ou livre, com contraste mínimo de
    4,5:1 com o branco (WCAG AA);
  - logo em PNG, JPG ou WebP, com até 512 KB, exibido no menu do painel e
    na tela de login.

**Planejado**

- Agenda própria por profissional (dias e horários diferentes dos da
  clínica) e bloqueios, como férias e intervalos
- Lembretes de consulta para o paciente
- Ligar o agendamento realizado ao registro de atendimento no prontuário

Os temas de plataforma SaaS que ainda faltam estão no [Roadmap](#roadmap).

## Roadmap

Recursos que um SaaS em produção teria e que ainda serão desenvolvidos. A
ordem é uma sugestão de prioridade. Auditoria e LGPD vêm primeiro porque o
sistema guarda dados de saúde.

- [x] **Auditoria.** Ver [Auditoria](#auditoria). Pendências:
  - [ ] registrar tentativas de login com falha (`auth.login_failed`), só
    para e-mails de usuários existentes. Há um `TODO(audit)` no
    `AuthService`;
  - [ ] registrar o acesso a dados de pacientes, quando o módulo existir.
- [x] **LGPD da clínica.** Ver [Privacidade (LGPD)](#privacidade-lgpd).
  Pendências:
  - [ ] anonimização de um usuário a pedido dele;
  - [ ] aceite versionado dos Termos de Uso e do contrato de tratamento de
    dados;
  - [ ] exportação em segundo plano, para clínicas grandes;
  - [ ] LGPD de pacientes: base legal, consentimento e retenção do
    prontuário (20 anos, pela regra do CFM). Dados de saúde são dados
    sensíveis pela lei.
- [x] **Row-Level Security no Postgres.** Ver [Multi-tenancy](#multi-tenancy).
- [x] **CI.** GitHub Actions com lint, testes e build a cada push.
- [ ] **Convite por e-mail e recuperação de senha.**
  - Substituir a senha provisória repassada à mão por um link de convite com
    validade.
  - "Esqueci minha senha" com token de uso único.
  - Exige um serviço de envio de e-mail.
- [ ] **Planos e cobrança.**
  - Assinaturas com um provedor de pagamento (Stripe, Asaas etc.).
  - Limites por plano, como número de usuários e de profissionais.
  - Período de teste.
  - Suspensão automática por falta de pagamento, reaproveitando a inativação
    de clínica que já existe.
- [ ] **Observabilidade por tenant.**
  - Logs estruturados com o `tenantId`.
  - Métricas de uso por clínica e alertas.
  - Limite de requisições por clínica, para que uma não sobrecarregue as
    outras.
- [ ] **Personalização por tenant.** Logo, cor principal, subdomínio, fuso
  horário e duração padrão da consulta já existem. Pendências:
  - [ ] textos de lembrete.

## Papéis

| Quem                    | Onde entra        | O que pode fazer                                            |
| ----------------------- | ----------------- | ----------------------------------------------------------- |
| Admin master            | `admin.<domínio>/master/login` | todas as clínicas e os usuários delas          |
| Administrador (`ADMIN`) | `<slug>.<domínio>/login` | tudo na **própria** clínica: equipe, pacientes, prontuário, histórico e LGPD |
| Recepção (`RECEPTION`)  | `<slug>.<domínio>/login` | cadastra e edita pacientes; consulta o prontuário    |
| Profissional (`PROFESSIONAL`) | `<slug>.<domínio>/login` | consulta pacientes e registra atendimentos e adendos |

Um usuário pode ter **vários papéis**, por exemplo administrador e
profissional ao mesmo tempo, e as permissões somam. O admin define os papéis
em **Equipe → Editar papéis**. Ninguém tira o próprio papel de admin, e a
clínica nunca fica sem um admin ativo. Os papéis não vão no token: o backend
lê do banco a cada requisição, então uma mudança vale na hora.

Permissões sobre pacientes:

| Ação                                     | Recepção | Profissional | Admin |
| ---------------------------------------- | :------: | :----------: | :---: |
| Listar, buscar e abrir a ficha           | ✅       | ✅           | ✅    |
| Cadastrar, editar e inativar paciente    | ✅       | ❌           | ✅    |
| Ver os atendimentos                      | ✅       | ✅           | ✅    |
| Registrar atendimento                    | ❌       | ✅           | ✅    |
| Adicionar adendo                         | ❌       | só no próprio registro | ✅ |

Permissões na agenda:

| Ação                                        | Recepção | Profissional | Admin |
| ------------------------------------------- | :------: | :----------: | :---: |
| Ver a agenda de todos                       | ✅       | ✅           | ✅    |
| Agendar, remarcar e cancelar                | ✅       | só na própria agenda | ✅ |
| Confirmar, marcar realizado ou falta        | ✅       | só na própria agenda | ✅ |

O admin master **não vê dados de pacientes**: só a quantidade por clínica. Na
LGPD, a clínica é a controladora dos dados de saúde.

O admin master não pertence a nenhuma clínica. Ele fica em uma tabela
própria (`platform_admins`) e tem sessão separada, com cookies diferentes.
Um token de clínica nunca abre uma rota do master, e vice-versa.

## Stack

| Camada    | Tecnologias                                                    |
| --------- | -------------------------------------------------------------- |
| Backend   | NestJS, TypeScript, Prisma 7, JWT, class-validator, argon2, Vitest |
| Banco     | PostgreSQL 17 (Docker)                                         |
| Frontend  | Nuxt 4, Vue 3, Vuetify 4 (Material Design 3), TypeScript       |
| Qualidade | oxlint (backend), ESLint (frontend), testes unitários e e2e    |

## Estrutura

```
saas-clinicas/
├── saas-clinicas-backend/    # API NestJS (porta 3001)
│   ├── prisma/               # schema e migrations
│   ├── scripts/              # create-platform-admin (cria o admin master)
│   ├── src/
│   │   ├── audit/            # log de auditoria e contexto da requisição
│   │   ├── auth/             # sessões, guards, @Public/@Roles/@PlatformRoute
│   │   ├── clinics/          # dados da clínica
│   │   ├── common/           # validações e erros compartilhados
│   │   ├── config/           # validação das variáveis de ambiente
│   │   ├── platform/         # rotas do admin master (/api/platform)
│   │   ├── prisma/           # PrismaService e escopo por tenant
│   │   ├── privacy/          # LGPD: exportação, exclusão e job diário
│   │   └── users/            # gestão da equipe de uma clínica
│   └── test/                 # testes e2e
├── saas-clinicas-frontend/   # aplicação Nuxt (porta 3000)
│   ├── server/api/           # proxy /api → backend
│   ├── shared/utils/         # regras de host e slug (app e servidor)
│   └── app/
│       ├── components/       # formulário de clínica, usuários, histórico
│       ├── composables/      # useApi (renova a sessão), useAuth, usePlatformAuth
│       ├── layouts/          # público, painel da clínica e master
│       ├── middleware/       # area (global), auth, admin, guest, platform-auth, platform-guest
│       ├── pages/            # /, /login, /trocar-senha, /painel/**, /master/**
│       └── utils/            # máscaras, validações, horários, erros, ações do log
├── docker/                   # script de inicialização do Postgres
├── insomnia/                 # coleção do Insomnia para testar a API
├── docker-compose.yml
└── Makefile
```

## Multi-tenancy

O isolamento é feito por coluna: a clínica é o tenant, e toda entidade de
negócio tem um `tenantId` apontando para ela. As regras são:

- toda consulta e escrita no backend filtra pelo tenant do usuário autenticado;
- o tenant vem do token de autenticação, nunca de um parâmetro enviado pelo
  cliente;
- os testes cobrem que um tenant não acessa os dados de outro.

No código, isso é garantido pelo `prisma.forTenant(tenantId)`: uma extensão
do Prisma que acrescenta o filtro de tenant em toda leitura e escrita. Os
services usam esse client com o `tenantId` que vem do token, e não precisam
lembrar do filtro em cada consulta. Um id de outra clínica simplesmente não
é encontrado (404).

A única exceção são as rotas do admin master (`/api/platform/clinics/:id/...`),
em que a clínica vem da URL. Elas só aceitam a sessão de plataforma e usam o
mesmo `forTenant` com esse id.

### Subdomínios

Cada clínica tem um `slug` único (`sorriso` em `sorriso.dominio.com`). Ele é
escolhido pelo master na criação (o formulário sugere a partir do nome), não
muda depois e não pode ser um nome reservado (`admin`, `www`, `api`...).

| Endereço              | Área    | Páginas                                   |
| --------------------- | ------- | ----------------------------------------- |
| `<domínio>`           | raiz    | `/`: campo para digitar o endereço da clínica |
| `admin.<domínio>`     | master  | `/master/**`                              |
| `<slug>.<domínio>`    | clínica | `/login`, `/painel/**`, `/trocar-senha`   |

- Os cookies não têm `Domain`, então ficam presos ao subdomínio: a sessão
  de uma clínica não chega ao endereço de outra, nem ao do master.
- O proxy do Nuxt calcula a área pelo `Host`, recusa as rotas da API de outra
  área (404) e envia ao backend o header `X-Clinic-Slug`. O valor enviado pelo
  navegador é descartado.
- O login exige o `X-Clinic-Slug` e só aceita usuários daquela clínica. Para
  os demais, responde o mesmo `401` de senha errada.
- Nas outras rotas, o guard confere que o token é da clínica do header,
  quando ele vem. Sem o header (chamada direta ao backend), vale só o token.
- A tela de login renderiza no servidor, já com o nome, a cor e o logo, a
  partir de `GET /api/public/clinics/:slug`. Clínica inativa ou inexistente
  responde `404 CLINIC_NOT_FOUND`, sem diferenciar.
- O domínio vem de `NUXT_PUBLIC_BASE_DOMAIN` (padrão `localhost`). Em
  desenvolvimento, `*.localhost` aponta para a própria máquina, sem precisar
  mexer no `/etc/hosts`.

### Row-Level Security (segunda camada)

Além do filtro da aplicação, o **próprio Postgres** recusa linhas de outras
clínicas. Se uma consulta escapar do `forTenant` (SQL cru, um bug, um filtro
esquecido), o banco devolve zero linhas em vez de vazar dados.

- **Como liga:** cada operação do `forTenant` roda numa transação curta que
  começa com:
  ```sql
  SET LOCAL ROLE app_tenant;                               -- papel restrito
  SELECT set_config('app.tenant_id', '<id da clínica>', true);
  ```
  As políticas de `clinics`, `clinic_business_hours`, `clinic_brandings`,
  `users`, `refresh_tokens`, `audit_logs`, `patients`, `patient_records` e
  `appointments` só deixam
  passar linhas em que `tenantId = app_current_tenant()`.
- **Transações com várias operações:** use
  `prisma.tenantTransaction(tenantId, async (tx) => …)`. Ela faz o mesmo
  ajuste uma vez no início. Dentro do callback, use só o `tx` recebido.
- **Sem clínica definida, nada passa:** sem `app.tenant_id`, nenhuma linha é
  visível.
- **Permissões:** o papel `app_tenant` só pode ler e inserir em `audit_logs`,
  o que reforça a imutabilidade no nível de permissão.
- **Fora do RLS:** o client sem escopo continua com o usuário dono das
  tabelas, que não é afetado pelas políticas. É o que atende login, refresh,
  rotas do master e o job de LGPD.
- **Testes:** os e2e de `test/row-level-security.e2e-spec.ts` usam SQL cru
  para provar o isolamento sem a ajuda da aplicação.

> A migration cria o papel `app_tenant`, o que exige permissão `CREATEROLE`.
> No Docker local e na CI o usuário é superusuário. Em bancos gerenciados
> (RDS, Supabase etc.), crie o papel antes com `CREATE ROLE app_tenant
> NOLOGIN;` e conceda-o ao usuário da aplicação (`GRANT app_tenant TO
> <usuário>;`).

## Modelo de dados

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

## Autenticação

Existem duas sessões independentes, com as mesmas regras:

|                | Clínica                                  | Admin master                                         |
| -------------- | ---------------------------------------- | ---------------------------------------------------- |
| Login          | `POST /api/auth/login`                   | `POST /api/platform/auth/login`                      |
| Access token   | cookie `access_token` (JWT `aud: tenant`, com usuário e clínica) | cookie `platform_access_token` (JWT `aud: platform`) |
| Refresh token  | cookie `refresh_token` (path `/api/auth`) | cookie `platform_refresh_token` (path `/api/platform/auth`) |

- Os cookies são `httpOnly` e `SameSite=Lax`, e o JavaScript da página não
  consegue lê-los. O access token dura 15 minutos e o refresh token, 7 dias.
  No banco fica só o hash do refresh token.
- A cada renovação, o refresh token usado é revogado e um novo é emitido. Se
  um token já usado for reapresentado, todas as sessões daquela conta são
  encerradas.
- A cada requisição, o backend confere se a conta e a clínica continuam
  ativas. Por isso, inativar alguém tem efeito imediato, sem esperar o token
  expirar.
- Com senha provisória (`mustChangePassword`), a sessão só acessa
  `/api/auth/me`, `/api/auth/change-password` e `/api/auth/logout`. O resto
  responde `403` com o código `PASSWORD_CHANGE_REQUIRED`.
- No código:
  - todas as rotas exigem login de clínica, exceto as marcadas com
    `@Public()` ou `@PlatformRoute()`;
  - `@Roles('ADMIN')` restringe as rotas por papel.
- Cada login aceita até 5 tentativas por minuto por IP.
- O frontend acessa a API pelo proxy `/api` do próprio Nuxt
  (`server/api/[...path].ts`), para que os cookies fiquem na mesma origem. O
  proxy descarta o `X-Forwarded-For` enviado pelo navegador e informa o IP
  real da conexão, para que ninguém forje o IP gravado na auditoria. As áreas
  logadas renderizam no navegador.

## Auditoria

Segue o formato usado no mercado (WorkOS, AWS CloudTrail e o audit log do
GitHub): **eventos explícitos com significado de negócio**.

- **Formato:** `ator · ação · alvo · contexto (IP, user agent) · data · metadata`.
  As ações seguem a convenção `recurso.verbo_no_passado`, por exemplo
  `user.deactivated` ou `clinic.deletion_confirmed`. O catálogo completo está
  em `src/audit/audit-actions.ts`.
- **Na mesma transação:** cada service chama
  `audit.log(tx, 'user.deactivated', { target })` dentro da transação da ação.
  Ou a ação e o registro são gravados juntos, ou nenhum dos dois.
- **Contexto implícito:** ator, IP e user agent vêm do contexto da requisição
  (`nestjs-cls`, que usa AsyncLocalStorage). Ninguém precisa passar esses
  dados por parâmetro.
- **Imutável:** uma trigger no Postgres bloqueia `UPDATE` e `DELETE` em
  `audit_logs`. A única exceção são as rotinas de LGPD, que ligam
  `app.audit_maintenance` só dentro da própria transação.
- **Sem dados pessoais no `metadata`:** só ids, papéis, booleanos e os campos
  alterados.
- **Quem vê:**

  | Quem                    | O que vê                                         |
  | ----------------------- | ------------------------------------------------ |
  | Admin master            | tudo, de todas as clínicas e da plataforma       |
  | Administrador (`ADMIN`) | tudo da **própria** clínica                      |
  | Profissional / Recepção | nada                                             |

## Privacidade (LGPD)

A clínica é a **controladora** dos dados, e a plataforma é a **operadora**. O
sistema dá à clínica as ferramentas para atender os direitos dos titulares.

- **Exportação (portabilidade):** baixa um JSON com a clínica, os horários,
  a equipe (sem hashes de senha) e o histórico de atividades. Cada exportação
  é registrada no log.
  - Feita pelo admin, em `/painel/clinica`, inclui também os pacientes e os
    prontuários.
  - Feita pelo master, traz só a **quantidade** de pacientes, e o nome deles
    aparece como "Paciente" no histórico.
- **Prontuário:** o texto clínico e o CPF nunca vão para o log de auditoria.
  Toda abertura da ficha fica registrada (`patient.viewed`), e as edições
  registram só os **nomes** dos campos alterados.
- **Exclusão em duas etapas:**

  | Situação     | Como chega lá                         | O que acontece                                              |
  | ------------ | ------------------------------------- | ----------------------------------------------------------- |
  | `REQUESTED`  | o admin solicita, digitando o nome da clínica | a clínica segue funcionando; o admin ainda pode desistir |
  | `SCHEDULED`  | o master confirma                     | a exclusão é agendada para daqui a **30 dias** e a clínica fica **somente leitura** |
  | `NONE`       | o master recusa, ou o master ou o admin cancelam | tudo volta ao normal                             |

- **Somente leitura (carência):** a equipe continua entrando e consultando,
  e pode exportar os dados.
  - Qualquer escrita responde `403 CLINIC_READ_ONLY`. As exceções são as rotas
    com `@AllowDuringDeletion()`: trocar a própria senha e cancelar a exclusão.
  - Um aviso no topo do painel mostra quantos dias faltam. O admin vê o botão
    **Cancelar exclusão**; os demais são orientados a falar com ele.

- **Exclusão definitiva:** um job diário (`PurgeService`, às 3h) exclui as
  clínicas cuja carência terminou, numa única transação:
  1. anonimiza os logs da clínica: os nomes viram "Removido" e IP, user agent
     e metadata são apagados;
  2. apaga a clínica, e com ela a equipe, os horários e as sessões;
  3. registra `clinic.purged` como prova de que a exclusão foi feita.
- **Minimização:** IP e user agent são apagados dos logs com mais de
  `AUDIT_IP_RETENTION_DAYS` dias (padrão 180).

> A parte técnica segue a LGPD, mas regras como prazos de retenção, base
> legal e o tratamento de dados de pacientes precisam de validação jurídica.

## Como rodar

### Pré-requisitos

- Node.js 24+
- Docker com Docker Compose (por exemplo, o Docker Desktop aberto)
- `make` (já vem no macOS e no Linux)

### 1. Instalar as dependências

Na raiz do repositório:

```bash
make install
```

A raiz não tem `package.json`, então rodar `npm install` nela dá erro. O
`make install` roda o `npm install` dentro de `saas-clinicas-backend/` e de
`saas-clinicas-frontend/`, e a instalação do backend também gera o client do
Prisma.

### 2. Configurar o ambiente do backend

```bash
cp saas-clinicas-backend/.env.example saas-clinicas-backend/.env
```

Os valores padrão já funcionam com o banco do `docker-compose.yml`.

| Variável       | Padrão                                                            | Descrição                    |
| -------------- | ----------------------------------------------------------------- | ---------------------------- |
| `DATABASE_URL` | `postgresql://saas_clinicas:saas_clinicas@localhost:5432/saas_clinicas` | conexão com o Postgres |
| `PORT`         | `3001`                                                            | porta da API                 |
| `CORS_ORIGIN`  | `http://localhost:3000`                                           | origem permitida (frontend)  |
| `JWT_ACCESS_SECRET` | (obrigatório)                                                | segredo do JWT, com pelo menos 32 caracteres |
| `ACCESS_TOKEN_TTL_SECONDS` | `900`                                                  | validade do access token     |
| `REFRESH_TOKEN_TTL_DAYS` | `7`                                                      | validade do refresh token    |
| `COOKIE_SECURE` | `false`                                                          | `true` em produção (HTTPS)   |
| `LOGIN_RATE_LIMIT` | `5`                                                           | tentativas de login por minuto, por IP |
| `AUDIT_IP_RETENTION_DAYS` | `180`                                                  | dias até o IP sair dos logs de auditoria |

Depois de copiar o arquivo, troque o `JWT_ACCESS_SECRET` por um valor
aleatório, gerado com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No frontend, o endereço do backend usado pelo proxy `/api` pode ser trocado
com a variável `NUXT_API_URL` (padrão `http://localhost:3001`). Ela é lida
quando o servidor inicia, então não exige refazer o build.

### 3. Subir o banco e aplicar as migrations

```bash
make migrate
```

Esse alvo sobe o Postgres, espera ele ficar saudável, aplica as migrations,
regenera o client do Prisma e roda a seed.

### 4. Admin master

Não existe cadastro público: as clínicas são criadas pelo admin master. A
seed de desenvolvimento (`make seed`, que o `make migrate` já roda) cria o
master padrão e uma clínica de exemplo:

| Onde                                | Usuário          | Senha      |
| ----------------------------------- | ---------------- | ---------- |
| http://admin.localhost:3000/master  | `admin`          | `admin`    |
| http://demo.localhost:3000/login    | `admin@demo.com` | `demo1234` |

A clínica `demo` também ganha uma equipe e pacientes fictícios, para testar a
agenda. Todos usam a senha `demo1234`:

| Usuário             | Papel        |
| ------------------- | ------------ |
| `ana@demo.com`      | profissional |
| `bruno@demo.com`    | profissional |
| `recepcao@demo.com` | recepção     |

> Essas credenciais são só para desenvolvimento. A seed se recusa a rodar com
> `NODE_ENV=production` e não sobrescreve o admin se ele já existir. Fora do
> ambiente local, crie um master com senha forte:
>
> ```bash
> cd saas-clinicas-backend
> npm run platform:create-admin -- --name "Seu Nome" --email voce@exemplo.com
> ```
>
> O script pede a senha (mínimo de 8 caracteres) ou a lê da variável
> `PLATFORM_ADMIN_PASSWORD`. Se o e-mail já existir, ele atualiza a senha e
> reativa a conta.

### 5. Subir a aplicação

```bash
make up
```

Esse comando sobe o banco, o backend e o frontend juntos. Depois:

1. Entre em http://admin.localhost:3000/master/login com `admin` / `admin` e
   crie uma clínica. Anote o endereço e a senha provisória do administrador.
2. Entre no endereço da clínica (por exemplo,
   http://sorriso.localhost:3000/login) com o administrador, troque a senha e
   cadastre a equipe em **Equipe**. A clínica `demo` da seed já está pronta
   em http://demo.localhost:3000.

> `*.localhost` funciona direto no Chrome, no Firefox e no `curl`. Se o seu
> navegador não resolver, acrescente `127.0.0.1 demo.localhost admin.localhost`
> ao `/etc/hosts`.

A API responde em http://localhost:3001/api (`GET /api/health` para checar).
Para subir só um dos lados, use `make up back` ou `make up front`. `Ctrl+C`
encerra tudo.

## Comandos úteis

**Raiz**

| Comando           | O que faz                                     |
| ----------------- | --------------------------------------------- |
| `make install`    | instala as dependências do backend e frontend |
| `make up`         | sobe banco + backend + frontend               |
| `make db`         | sobe só o Postgres                            |
| `make db-down`    | para o Postgres (os dados ficam no volume)    |
| `make migrate`    | cria e aplica migrations no banco de dev e roda a seed |
| `make seed`       | cria o admin master padrão (`admin` / `admin`) |

**Backend** (`saas-clinicas-backend/`)

| Comando                         | O que faz                                     |
| ------------------------------- | --------------------------------------------- |
| `npm run start:dev`             | servidor em modo desenvolvimento              |
| `npm run test`                  | testes unitários                              |
| `npm run test:e2e`              | testes e2e (precisam do Postgres rodando)     |
| `npm run lint`                  | lint                                          |
| `npm run db:seed`               | seed de desenvolvimento (admin master padrão) |
| `npm run platform:create-admin` | cria ou reativa um admin master               |
| `npm run db:studio`             | abre o Prisma Studio para inspecionar o banco |
| `npx prisma generate`           | regenera o client após mudar o schema         |

**Frontend** (`saas-clinicas-frontend/`)

| Comando              | O que faz                         |
| -------------------- | --------------------------------- |
| `npm run dev`        | servidor em modo desenvolvimento  |
| `npm run lint`       | lint                              |
| `npm run typecheck`  | checagem de tipos                 |

## Testes

A CI (`.github/workflows/ci.yml`) roda tudo isto a cada push e pull request
na `main`: lint, testes unitários, e2e (com um Postgres de serviço) e build
do backend, além de lint e typecheck do frontend.

Os testes e2e rodam contra um banco separado, o `saas_clinicas_test`, que o
container cria automaticamente na primeira vez que sobe. Antes de cada
execução, as migrations pendentes são aplicadas nele, e cada teste limpa os
próprios dados. Com o banco no ar (`make db`):

```bash
cd saas-clinicas-backend
npm run test       # unitários
npm run test:e2e   # e2e
```

Os e2e cobrem, entre outros cenários:

- uma clínica não enxerga nem altera dados de outra;
- um token de clínica não abre rotas do master, e vice-versa;
- inativar um usuário ou uma clínica derruba a sessão aberta na hora;
- quem não é administrador não gerencia a equipe;
- a troca de senha provisória é obrigatória;
- uma ação que falha não deixa registro no log, e o log não pode ser alterado;
- o admin só vê o histórico da própria clínica, e os demais usuários não veem
  nada;
- o fluxo completo de exclusão, com logs anonimizados depois da exclusão
  definitiva;
- o Row-Level Security, que barra o acesso a outra clínica mesmo com SQL cru;
- pacientes: o mesmo CPF em clínicas diferentes, permissões por papel,
  imutabilidade do prontuário e o master sem acesso aos dados de saúde.

## API

Para testar no Insomnia, importe a coleção em [`insomnia/`](insomnia/README.md),
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

### Agendamentos

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

### `POST /api/platform/clinics`

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
