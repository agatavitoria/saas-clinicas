# SaaS Clínicas

Sistema de agenda e gestão para clínicas pequenas e consultórios, no modelo
SaaS multi-tenant: cada clínica tem seus próprios usuários, pacientes e
agenda, e nunca enxerga dados de outra clínica.

> Projeto de estudo desenvolvido com padrão de qualidade profissional:
> código limpo, testado e bem estruturado.

## Funcionalidades

**Disponível**

- **Admin master (plataforma)**, em `/master`:
  - cria clínicas (dados, horário de funcionamento e administrador);
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

**Planejado**

- Pacientes
- Profissionais com agenda própria
- Agendamentos com status: agendado, confirmado, cancelado, realizado, faltou

Os temas de plataforma SaaS que ainda faltam estão no [Roadmap](#roadmap).

## Roadmap

Recursos que um SaaS em produção teria e que ainda serão desenvolvidos. A
ordem é uma sugestão de prioridade. Auditoria e LGPD vêm primeiro porque o
sistema guarda dados de saúde.

- [ ] **Auditoria.** Registrar quem fez o quê e quando: login, criação e
  inativação de usuários, mudanças na clínica e, no futuro, acesso a dados de
  pacientes. Cada registro tem o `tenantId` da clínica, o usuário que agiu, a
  ação e a data. O master vê o log de qualquer clínica; o admin, só o da
  própria.
- [ ] **LGPD.**
  - Exportar todos os dados de uma clínica (portabilidade).
  - Excluir os dados definitivamente quando o cliente pedir (direito ao
    esquecimento), separando isso da simples inativação.
  - Política de retenção e registro de consentimento dos pacientes.
  - Dados de saúde são dados sensíveis pela lei.
- [ ] **Row-Level Security no Postgres.** Uma segunda camada de isolamento,
  aplicada pelo próprio banco: cada conexão informa o tenant (por exemplo,
  `SET app.tenant_id`), e as policies bloqueiam linhas de outras clínicas
  mesmo que uma consulta escape do `forTenant`.
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
- [ ] **Personalização por tenant.** Logo, cores e preferências de cada
  clínica, como fuso horário, duração padrão da consulta e textos de
  lembrete.

## Papéis

| Quem                    | Onde entra        | O que pode fazer                                            |
| ----------------------- | ----------------- | ----------------------------------------------------------- |
| Admin master            | `/master/login`   | todas as clínicas e os usuários delas                       |
| Administrador (`ADMIN`) | `/login`          | painel e gestão da equipe da **própria** clínica            |
| Profissional / Recepção | `/login`          | painel da própria clínica (vê a equipe, não a gerencia)     |

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
│   │   ├── auth/             # sessões, guards, @Public/@Roles/@PlatformRoute
│   │   ├── clinics/          # dados da clínica
│   │   ├── common/           # validações e erros compartilhados
│   │   ├── config/           # validação das variáveis de ambiente
│   │   ├── platform/         # rotas do admin master (/api/platform)
│   │   ├── prisma/           # PrismaService e escopo por tenant
│   │   └── users/            # gestão da equipe de uma clínica
│   └── test/                 # testes e2e
├── saas-clinicas-frontend/   # aplicação Nuxt (porta 3000)
│   └── app/
│       ├── components/       # formulário de clínica, tabela/diálogos de usuários
│       ├── composables/      # useApi (renova a sessão), useAuth, usePlatformAuth
│       ├── layouts/          # público, painel da clínica e master
│       ├── middleware/       # auth, admin, guest, platform-auth, platform-guest
│       ├── pages/            # /, /login, /trocar-senha, /painel/**, /master/**
│       └── utils/            # máscaras, validações, horários, mensagens de erro
├── docker/                   # script de inicialização do Postgres
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

## Modelo de dados

```mermaid
erDiagram
    clinics ||--|{ clinic_business_hours : "funciona em"
    clinics ||--|{ users : "tem equipe"
    clinics ||--o{ refresh_tokens : "isola por tenant"
    users ||--o{ refresh_tokens : "tem sessões"
    platform_admins ||--o{ platform_refresh_tokens : "tem sessões"

    clinics {
        uuid id PK "é o tenantId das demais tabelas"
        string name
        string email
        string phone
        string document "CPF ou CNPJ, opcional"
        boolean active "inativa bloqueia toda a equipe"
        datetime createdAt
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
        enum role "ADMIN, PROFESSIONAL, RECEPTION"
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
```

Como ler o diagrama:

- **`clinics`** é o tenant. As outras tabelas da clínica apontam para ela pela
  coluna `tenantId`. Uma clínica com `active = false` bloqueia o acesso de toda
  a equipe.
- **`clinic_business_hours`** tem uma linha por dia de funcionamento. O par
  (`tenantId`, `weekday`) é único, então não há dois horários para o mesmo dia.
  Toda clínica tem pelo menos um dia.
- **`users`** é a equipe. Toda clínica tem pelo menos um administrador ativo:
  o sistema não deixa inativar o último.
- **`refresh_tokens`** guarda as sessões. Cada linha pertence a um usuário e
  também leva o `tenantId`, para ser filtrada pela clínica como as demais.
- **`platform_admins`** e **`platform_refresh_tokens`** são do admin master. Não
  têm `tenantId`, porque não pertencem a nenhuma clínica.
- Apagar uma clínica apaga em cascata todos os dados dela (`onDelete: Cascade`).

## Autenticação

Existem duas sessões independentes, com as mesmas regras:

|                | Clínica                                  | Admin master                                         |
| -------------- | ---------------------------------------- | ---------------------------------------------------- |
| Login          | `POST /api/auth/login`                   | `POST /api/platform/auth/login`                      |
| Access token   | cookie `access_token` (JWT `aud: tenant`) | cookie `platform_access_token` (JWT `aud: platform`) |
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
- O frontend acessa a API pelo proxy `/api` do próprio Nuxt, para que os
  cookies fiquem na mesma origem. As áreas logadas renderizam no navegador.

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

Depois de copiar o arquivo, troque o `JWT_ACCESS_SECRET` por um valor
aleatório, gerado com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No frontend, o endereço do backend usado pelo proxy `/api` pode ser trocado
com a variável `API_URL` (padrão `http://localhost:3001`).

### 3. Subir o banco e aplicar as migrations

```bash
make migrate
```

Esse alvo sobe o Postgres, espera ele ficar saudável, aplica as migrations,
regenera o client do Prisma e roda a seed.

### 4. Admin master

Não existe cadastro público: as clínicas são criadas pelo admin master. A
seed de desenvolvimento (`make seed`, que o `make migrate` já roda) cria o
master padrão:

| Usuário | Senha   |
| ------- | ------- |
| `admin` | `admin` |

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

1. Entre em http://localhost:3000/master/login com `admin` / `admin` e crie
   uma clínica. Anote a senha provisória do administrador.
2. Entre em http://localhost:3000/login com o administrador da clínica, troque
   a senha e cadastre a equipe em **Equipe**.

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
- a troca de senha provisória é obrigatória.

## API

Todas as rotas ficam sob o prefixo `/api`. Os erros de regra de negócio
trazem um `code` estável (por exemplo, `EMAIL_IN_USE` ou `USER_INACTIVE`),
que o frontend traduz para uma mensagem em português.

**Clínica**

| Método | Rota                              | Acesso       | Descrição                                   |
| ------ | --------------------------------- | ------------ | ------------------------------------------- |
| GET    | `/api/health`                     | pública      | checagem de saúde                           |
| POST   | `/api/auth/login`                 | pública      | login (`{ email, password }`)               |
| POST   | `/api/auth/refresh`               | pública      | renova a sessão a partir do `refresh_token` |
| POST   | `/api/auth/logout`                | pública      | encerra a sessão e limpa os cookies         |
| GET    | `/api/auth/me`                    | logado       | usuário logado (inclui `mustChangePassword`) |
| POST   | `/api/auth/change-password`       | logado       | `{ currentPassword, newPassword }`          |
| GET    | `/api/clinics/me`                 | logado       | dados e horários da clínica do usuário      |
| GET    | `/api/users`                      | logado       | equipe da clínica                           |
| POST   | `/api/users`                      | `ADMIN`      | cria usuário com senha provisória           |
| PATCH  | `/api/users/:id/status`           | `ADMIN`      | `{ active }`: inativa ou reativa            |
| POST   | `/api/users/:id/reset-password`   | `ADMIN`      | `{ temporaryPassword }`                     |

**Admin master**

| Método | Rota                                                | Descrição                                   |
| ------ | --------------------------------------------------- | ------------------------------------------- |
| POST   | `/api/platform/auth/login` · `refresh` · `logout`  | sessão do master (login/refresh/logout públicos) |
| GET    | `/api/platform/auth/me`                             | admin logado                                |
| GET    | `/api/platform/clinics`                             | todas as clínicas, com número de usuários   |
| POST   | `/api/platform/clinics`                             | cria clínica + administrador                |
| GET    | `/api/platform/clinics/:id`                         | dados e horários                            |
| PATCH  | `/api/platform/clinics/:id/status`                  | `{ active }`: inativar derruba toda a equipe |
| GET    | `/api/platform/clinics/:id/users`                   | equipe da clínica                           |
| POST   | `/api/platform/clinics/:id/users`                   | cria usuário                                |
| PATCH  | `/api/platform/clinics/:id/users/:userId/status`    | inativa ou reativa                          |
| POST   | `/api/platform/clinics/:id/users/:userId/reset-password` | nova senha provisória                  |

### `POST /api/platform/clinics`

Cria a clínica, os horários de funcionamento e o usuário administrador numa
única operação.

```json
{
  "clinic": {
    "name": "Clínica Sorriso",
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
- `document` (CPF ou CNPJ) é opcional.
- O administrador é criado com `mustChangePassword: true`.
- Respostas: `201` com a clínica e o administrador (sem a senha); `400` para
  dados inválidos; `409` (`EMAIL_IN_USE`) se o e-mail do administrador já
  estiver em uso.
