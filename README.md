# SaaS Clínicas

Sistema de agenda e gestão para clínicas pequenas e consultórios, no modelo
SaaS multi-tenant: cada clínica tem seus próprios usuários, pacientes e
agenda, e nunca enxerga dados de outra clínica.

> Projeto de estudo desenvolvido com padrão de qualidade profissional:
> código limpo, testado e bem estruturado.

## Funcionalidades

**Disponível**

- Cadastro público de clínica em 4 etapas: dados da clínica, horário de
  funcionamento, usuário administrador e revisão

**Planejado**

- Autenticação e papéis (administrador, profissional, recepção)
- Pacientes
- Profissionais com agenda própria
- Agendamentos com status: agendado, confirmado, cancelado, realizado, faltou

## Stack

| Camada    | Tecnologias                                                    |
| --------- | -------------------------------------------------------------- |
| Backend   | NestJS, TypeScript, Prisma 7, class-validator, argon2, Vitest  |
| Banco     | PostgreSQL 17 (Docker)                                         |
| Frontend  | Nuxt 4, Vue 3, Vuetify 4 (Material Design 3), TypeScript       |
| Qualidade | oxlint (backend), ESLint (frontend), testes unitários e e2e    |

## Estrutura

```
saas-clinicas/
├── saas-clinicas-backend/    # API NestJS (porta 3001)
│   ├── prisma/               # schema e migrations
│   ├── src/
│   │   ├── clinics/          # cadastro de clínicas
│   │   ├── common/           # validações compartilhadas (CPF/CNPJ etc.)
│   │   ├── config/           # validação das variáveis de ambiente
│   │   └── prisma/           # PrismaService
│   └── test/                 # testes e2e
├── saas-clinicas-frontend/   # aplicação Nuxt (porta 3000)
│   └── app/
│       ├── components/       # componentes (etapas do cadastro)
│       ├── pages/            # rotas: / e /cadastro
│       └── utils/            # máscaras, validações, montagem do payload
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

No frontend, a URL da API pode ser sobrescrita com `NUXT_PUBLIC_API_BASE`.

### 3. Subir o banco e aplicar as migrations

```bash
make migrate
```

Esse alvo sobe o Postgres, espera ele ficar saudável e aplica as migrations.

### 4. Subir a aplicação

```bash
make up
```

Esse comando sobe o banco, o backend e o frontend juntos. Depois, abra:

- Frontend: http://localhost:3000
- API: http://localhost:3001 (`GET /health` para checar)

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

### `POST /clinics`

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
- Respostas: `201` com a clínica e o administrador (sem a senha), `400` para
  dados inválidos e `409` se o e-mail do administrador já estiver em uso.
