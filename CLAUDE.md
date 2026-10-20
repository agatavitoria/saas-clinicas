# SaaS Clínicas

SaaS multi-tenant de agenda e gestão para clínicas pequenas e consultórios.
Cada clínica é um tenant: tem seus próprios usuários, pacientes e agenda, e
nunca enxerga dados de outra clínica.

Projeto de estudo com padrão de qualidade profissional: código limpo, testado
e bem estruturado.

## Estrutura

Monorepo com um único repositório git na raiz (`~/projetos/saas-clinicas`):

- `saas-clinicas-backend/` — API em NestJS (TypeScript)
- `saas-clinicas-frontend/` — aplicação web em Nuxt (TypeScript)

As subpastas NÃO devem ter `.git` próprio.

## Domínio (escopo inicial)

- **Clínica (tenant)**: nome, dados de contato, configurações de horário
- **Usuário**: pertence a uma clínica; papéis: administrador, profissional, recepção
- **Paciente**: pertence a uma clínica
- **Profissional**: usuário que atende e tem agenda própria
- **Agendamento**: paciente + profissional + data/hora + status
  (agendado, confirmado, cancelado, realizado, faltou)

## Regras de multi-tenancy

- Estratégia: coluna `tenantId` em cada tabela (banco e schema compartilhados)
- A clínica é o tenant: toda entidade de negócio tem `tenantId` apontando para `Clinic.id` (sempre `tenantId`, nunca `clinicId`)
- Toda consulta e escrita no backend filtra pelo tenant do usuário autenticado
- O tenant vem do token de autenticação, nunca de parâmetro enviado pelo cliente
- Testes devem cobrir que um tenant não acessa dados de outro

## Stack decidida

- Banco: PostgreSQL 17 (via `docker-compose.yml` na raiz)
- ORM: Prisma 7 (client gerado em `src/generated/prisma`, não versionado)
- Validação no backend: `class-validator` + `class-transformer` (ValidationPipe global)
- Senhas: hash com `argon2`
- UI do frontend: Vuetify (Material Design 3), integrado via `vite-plugin-vuetify`
- Autenticação: JWT em cookies httpOnly, com duas sessões independentes:
  - **clínica:** cookies `access_token`/`refresh_token`, JWT `aud: 'tenant'`
    com `sub`, `tenantId` e `role`;
  - **admin master (plataforma):** tabela `PlatformAdmin`, cookies
    `platform_access_token`/`platform_refresh_token` e JWT `aud: 'platform'`.

  O access token dura 15 minutos. O refresh token é rotacionado, guardado
  como hash e tem detecção de reuso. A regra de rotação é compartilhada em
  `src/auth/refresh-token-rotation.ts`.
- API sob o prefixo `/api`; o frontend acessa via proxy do Nuxt (`/api/**`)
- Não há cadastro público: o master cria as clínicas. O primeiro master é
  criado com `npm run platform:create-admin`.

## Padrões de código

- Backend: guard global `JwtAuthGuard`. Por padrão, toda rota exige a sessão
  de clínica.
  - `@Public()` libera a rota; `@PlatformRoute()` exige a sessão do master.
  - `@Roles('ADMIN')` restringe por papel (`RolesGuard`).
  - Com `mustChangePassword`, só rotas com `@AllowPendingPasswordChange()`
    respondem.
  - O guard confere no banco, a cada requisição, se o usuário e a clínica
    estão ativos.
  - O usuário vem de `@CurrentUser()`; o master, de `@CurrentPlatformAdmin()`.
- Acesso a dados de clínica sempre via `prisma.forTenant(tenantId)`. O
  `tenantId` vem do token, exceto nas rotas `/api/platform/clinics/:id/...`
  do master, onde vem da URL. O `prisma` sem escopo fica restrito a login,
  refresh e às rotas do master.
- Erros de regra de negócio usam os helpers de `src/common/api-error.ts`, com
  um `code` estável que o front traduz em `app/utils/api-errors.ts`.
- Frontend: chamadas à API via `useApi()`, que renova a sessão certa (clínica
  ou master) quando recebe 401.
  - Páginas da clínica usam `definePageMeta({ layout: 'dashboard', middleware: 'auth' })`
    (acrescente `'admin'` para restringir a administradores).
  - Páginas do master usam `layout: 'master'` com `middleware: 'platform-auth'`.

## Convenções

- Backend roda na porta 3001; frontend na 3000
- Código e nomes técnicos em inglês; textos da interface em português (pt-BR)
- Rodar lint e testes antes de considerar uma tarefa concluída
- Mudanças que envolvem back e front juntos vão no mesmo commit
- Para tarefas grandes, apresentar um plano antes de implementar

## Comandos

Raiz (não tem `package.json`):
- `make install` — `npm install` no backend e no frontend
- `make up [back|front]` — sobe banco + backend + frontend (ou só um deles)
- `make db` / `make db-down` — sobe/para o Postgres
- `make migrate` — cria/aplica migrations no banco de desenvolvimento (regenera o client e roda a seed)
- `make seed` — seed de desenvolvimento: admin master padrão `admin` / `admin` (só fora de produção)

Backend (`saas-clinicas-backend/`, copie `.env.example` para `.env`):
- `npm run start:dev` — servidor em modo desenvolvimento
- `npm run test` — testes unitários
- `npm run test:e2e` — testes e2e (usam o banco `saas_clinicas_test`)
- `npm run lint` — lint
- `npx prisma generate` — regenera o client após mudar o schema
- `npm run platform:create-admin -- --name "..." --email "..."` — cria/reativa um admin master

Frontend (`saas-clinicas-frontend/`):
- `npm run dev` — servidor em modo desenvolvimento
- `npm run lint` — lint
- `npm run typecheck` — checagem de tipos