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

- Toda entidade de negócio tem `tenantId` (ou `clinicId`)
- Toda consulta e escrita no backend filtra pelo tenant do usuário autenticado
- O tenant vem do token de autenticação, nunca de parâmetro enviado pelo cliente
- Testes devem cobrir que um tenant não acessa dados de outro

## Decisões ainda em aberto

Pergunte antes de escolher:

- Banco de dados e ORM
- Estratégia de multi-tenancy (coluna tenant_id, schema por tenant ou banco por tenant)
- Biblioteca de UI do frontend
- Estratégia de autenticação

## Convenções

- Backend roda na porta 3001; frontend na 3000
- Código e nomes técnicos em inglês; textos da interface em português (pt-BR)
- Rodar lint e testes antes de considerar uma tarefa concluída
- Mudanças que envolvem back e front juntos vão no mesmo commit
- Para tarefas grandes, apresentar um plano antes de implementar

## Comandos

Backend (`saas-clinicas-backend/`):
- `npm run start:dev` — servidor em modo desenvolvimento
- `npm run test` — testes
- `npm run lint` — lint

Frontend (`saas-clinicas-frontend/`):
- `npm run dev` — servidor em modo desenvolvimento