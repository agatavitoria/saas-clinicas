# SaaS Clínicas

Sistema de agenda e gestão para clínicas pequenas e consultórios, no modelo
SaaS multi-tenant: cada clínica tem seus próprios usuários, pacientes e
agenda, e nunca enxerga dados de outra clínica.

> Projeto de estudo desenvolvido com padrão de qualidade profissional:
> código limpo, testado e bem estruturado.

## Funcionalidades

**Disponível**

- Cadastro público de clínica em 4 etapas: dados da clínica, horário de
  funcionamento, usuário administrador e revisão. O administrador já sai
  logado.
- Login com sessão em cookies httpOnly (renovação automática e logout)
- Painel da clínica: dados de contato, status "aberta agora", horário da
  semana e equipe

**Planejado**

- Gestão da equipe e permissões por papel (administrador, profissional,
  recepção)
- Pacientes
- Profissionais com agenda própria
- Agendamentos com status: agendado, confirmado, cancelado, realizado, faltou

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
│   ├── src/
│   │   ├── auth/             # login, refresh, logout e guard global
│   │   ├── clinics/          # cadastro e dados da clínica
│   │   ├── common/           # validações compartilhadas (CPF/CNPJ etc.)
│   │   ├── config/           # validação das variáveis de ambiente
│   │   ├── prisma/           # PrismaService e escopo por tenant
│   │   └── users/            # equipe da clínica
│   └── test/                 # testes e2e
├── saas-clinicas-frontend/   # aplicação Nuxt (porta 3000)
│   └── app/
│       ├── components/       # componentes (etapas do cadastro)
│       ├── composables/      # useApi (com renovação de sessão) e useAuth
│       ├── layouts/          # público (default) e área logada (dashboard)
│       ├── middleware/       # auth (exige login) e guest (só visitantes)
│       ├── pages/            # /, /cadastro, /login e /painel
│       └── utils/            # máscaras, validações, horários
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
lembrar do filtro em cada consulta.

## Modelo de dados

```mermaid
erDiagram
    clinics ||--|{ clinic_business_hours : "funciona em"
    clinics ||--|{ users : "tem equipe"
    clinics ||--o{ refresh_tokens : "isola por tenant"
    users ||--o{ refresh_tokens : "tem sessões"

    clinics {
        uuid id PK "é o tenantId das demais tabelas"
        string name
        string email
        string phone
        string document "CPF ou CNPJ, opcional"
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
```

Como ler o diagrama:

- **`clinics`** é o tenant. As outras tabelas apontam para ela pela coluna
  `tenantId`.
- **`clinic_business_hours`** tem uma linha por dia de funcionamento. O par
  (`tenantId`, `weekday`) é único, então não há dois horários para o mesmo dia.
  Toda clínica tem pelo menos um dia.
- **`users`** é a equipe. Toda clínica tem pelo menos um usuário, o
  administrador criado no cadastro.
- **`refresh_tokens`** guarda as sessões. Cada linha pertence a um usuário e
  também leva o `tenantId`, para ser filtrada pela clínica como as demais.
- Apagar uma clínica apaga em cascata todos os dados dela (`onDelete: Cascade`).

## Autenticação

- O login devolve dois cookies `httpOnly` e `SameSite=Lax`, que o JavaScript
  da página não consegue ler:
  - `access_token`: JWT válido por 15 minutos, com o id do usuário, o
    `tenantId` e o papel;
  - `refresh_token`: válido por 7 dias e enviado só para `/api/auth`. No banco
    fica apenas o hash dele.
- A cada renovação, o refresh token usado é revogado e um novo é emitido. Se
  um token já usado for reapresentado, todas as sessões daquele usuário são
  encerradas.
- Todas as rotas exigem login, exceto as marcadas com `@Public()`.
- O login aceita até 5 tentativas por minuto por IP.
- O frontend acessa a API pelo proxy `/api` do próprio Nuxt, para que os
  cookies fiquem na mesma origem. A área logada (`/painel`) e o `/login`
  renderizam no navegador.

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

Esse alvo sobe o Postgres, espera ele ficar saudável, aplica as migrations e
regenera o client do Prisma.

### 4. Subir a aplicação

```bash
make up
```

Esse comando sobe o banco, o backend e o frontend juntos. Depois, abra:

- Frontend: http://localhost:3000 (cadastre uma clínica em `/cadastro` ou
  entre em `/login`)
- API: http://localhost:3001/api (`GET /api/health` para checar)

Para subir só um dos lados, use `make up back` ou `make up front`.
`Ctrl+C` encerra tudo.

## Comandos úteis

**Raiz**

| Comando           | O que faz                                     |
| ----------------- | --------------------------------------------- |
| `make install`    | instala as dependências do backend e frontend |
| `make up`         | sobe banco + backend + frontend               |
| `make db`         | sobe só o Postgres                            |
| `make db-down`    | para o Postgres (os dados ficam no volume)    |
| `make migrate`    | cria e aplica migrations no banco de dev      |

**Backend** (`saas-clinicas-backend/`)

| Comando              | O que faz                                          |
| -------------------- | -------------------------------------------------- |
| `npm run start:dev`  | servidor em modo desenvolvimento                   |
| `npm run test`       | testes unitários                                   |
| `npm run test:e2e`   | testes e2e (precisam do Postgres rodando)          |
| `npm run lint`       | lint                                               |
| `npm run db:studio`  | abre o Prisma Studio para inspecionar o banco      |
| `npx prisma generate`| regenera o client após mudar o schema              |

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

## API

Todas as rotas ficam sob o prefixo `/api` e exigem login, exceto as marcadas
como públicas.

| Método | Rota                | Acesso   | Descrição                                       |
| ------ | ------------------- | -------- | ----------------------------------------------- |
| GET    | `/api/health`       | pública  | checagem de saúde                               |
| POST   | `/api/clinics`      | pública  | cadastra a clínica e já abre a sessão do admin  |
| POST   | `/api/auth/login`   | pública  | login (`{ email, password }`)                   |
| POST   | `/api/auth/refresh` | pública  | renova a sessão a partir do `refresh_token`     |
| POST   | `/api/auth/logout`  | pública  | encerra a sessão e limpa os cookies             |
| GET    | `/api/auth/me`      | logado   | usuário logado                                  |
| GET    | `/api/clinics/me`   | logado   | dados e horários da clínica do usuário          |
| GET    | `/api/users`        | logado   | equipe da clínica do usuário                    |

### `POST /api/clinics`

Rota pública. Cria a clínica, os horários de funcionamento e o usuário
administrador numa única operação.

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
    "password": "senha-segura"
  }
}
```

- `weekday` vai de `0` (domingo) a `6` (sábado), e é preciso pelo menos um dia.
- `document` (CPF ou CNPJ) é opcional.
- Respostas: `201` com a clínica e o administrador (sem a senha), já com os
  cookies de sessão; `400` para dados inválidos; `409` se o e-mail do
  administrador já estiver em uso.
