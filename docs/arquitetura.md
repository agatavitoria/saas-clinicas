# Arquitetura e estrutura de pastas

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
│   │   ├── appointments/     # agenda: agendamentos, status e profissionais
│   │   ├── audit/            # log de auditoria e contexto da requisição
│   │   ├── auth/             # sessões, guards, @Public/@Roles/@PlatformRoute
│   │   ├── clinics/          # dados da clínica
│   │   ├── common/           # validações e erros compartilhados
│   │   ├── config/           # validação das variáveis de ambiente
│   │   ├── patients/         # pacientes e prontuário
│   │   ├── platform/         # rotas do admin master (/api/platform)
│   │   ├── prisma/           # PrismaService e escopo por tenant
│   │   ├── privacy/          # LGPD: exportação, exclusão e job diário
│   │   └── users/            # gestão da equipe de uma clínica
│   └── test/                 # testes e2e
├── saas-clinicas-frontend/   # aplicação Nuxt (porta 3000)
│   ├── server/api/           # proxy /api → backend
│   ├── shared/utils/         # regras de host e slug (app e servidor)
│   └── app/
│       ├── components/       # agenda, pacientes, clínica, usuários, histórico
│       ├── composables/      # useApi (renova a sessão), useAuth, usePlatformAuth
│       ├── layouts/          # público, painel da clínica e master
│       ├── middleware/       # area (global), auth, admin, guest, platform-auth, platform-guest
│       ├── pages/            # /, /login, /trocar-senha, /painel/** (agenda, pacientes...), /master/**
│       └── utils/            # máscaras, validações, horários, erros, ações do log
├── docker/                   # script de inicialização do Postgres
├── docs/                     # documentação detalhada (esta pasta)
├── insomnia/                 # coleção do Insomnia para testar a API
├── docker-compose.yml
└── Makefile
```
