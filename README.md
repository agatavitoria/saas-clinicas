# SaaS Clínicas

Sistema de agenda e gestão para clínicas pequenas e consultórios, no modelo
SaaS multi-tenant: cada clínica tem seus próprios usuários, pacientes e
agenda, e nunca enxerga dados de outra clínica.

## Objetivo

Projeto de estudo com padrão de qualidade profissional: código limpo, testado
e bem estruturado. O foco é aprender, na prática, os problemas de um SaaS
real: isolamento entre clientes, sessões seguras, auditoria, LGPD e
personalização por cliente.

O [guia de estudo](docs/guia-de-estudo.md) explica cada conceito de SaaS
aplicado e onde ele está no código.

## O que o sistema faz

- **Admin master (plataforma):** cria e gerencia as clínicas e a equipe delas.
- **Clínica:** equipe com papéis (administrador, recepção, profissional),
  pacientes, prontuário imutável com adendos e agenda com visão de dia e
  semana.
- **Personalização:** cada clínica tem endereço próprio
  (`sorriso.dominio.com`), nome, cor, logo, fuso horário e horário de
  funcionamento.
- **Segurança e LGPD:** auditoria imutável, exportação dos dados e exclusão da
  clínica em duas etapas.

Detalhes em [funcionalidades](docs/funcionalidades.md) e
[papéis e permissões](docs/permissoes.md).

## Tecnologias

| Camada    | Tecnologias                                                        |
| --------- | ------------------------------------------------------------------ |
| Backend   | NestJS, TypeScript, Prisma 7, JWT, class-validator, argon2, Vitest |
| Banco     | PostgreSQL 17 (Docker)                                             |
| Frontend  | Nuxt 4, Vue 3, Vuetify 4 (Material Design 3), TypeScript           |
| Qualidade | oxlint, ESLint, testes unitários e e2e, GitHub Actions             |

## Padrões trabalhados

- **Multi-tenancy por coluna:** toda tabela de clínica tem `tenantId`, e o
  tenant vem sempre do token, nunca do cliente.
  ([multi-tenancy](docs/multi-tenancy.md))
- **Isolamento em duas camadas:** filtro automático da aplicação
  (`prisma.forTenant`) e Row-Level Security no Postgres.
- **Endereço por clínica:** subdomínio por tenant, com um proxy no Nuxt que
  define a clínica de cada requisição.
- **Sessões seguras:** JWT em cookies httpOnly, sessões separadas para
  clínica e plataforma e refresh token rotacionado com detecção de reuso.
  ([autenticação](docs/autenticacao.md))
- **Autorização por papéis múltiplos:** guard global seguro por padrão, papéis
  lidos do banco a cada requisição e regras por recurso no service.
- **Auditoria na mesma transação** da ação, imutável no banco e sem dados
  pessoais. ([auditoria e LGPD](docs/auditoria-e-lgpd.md))
- **Regras críticas no banco:** unicidade por tenant, exclusion constraint
  contra horários sobrepostos na agenda e prontuário sem `UPDATE`.
- **Contrato estável com o front:** códigos de erro fixos, traduzidos no
  frontend. ([API](docs/api.md))
- **Testes de isolamento entre tenants** em e2e contra um banco real.
  ([testes](docs/testes.md))

## Como rodar

Pré-requisitos: Node.js 24+, Docker com Docker Compose e `make`.

```bash
make install                                                      # dependências do back e do front
cp saas-clinicas-backend/.env.example saas-clinicas-backend/.env
make migrate                                                      # banco, migrations e seed
make up                                                           # banco + backend + frontend
```

Antes de subir, troque o `JWT_ACCESS_SECRET` do `.env` por um valor aleatório
(o comando para gerar está em [ambiente de desenvolvimento](docs/desenvolvimento.md)).

Com tudo no ar:

| Onde                                | Usuário                       | Senha      |
| ----------------------------------- | ----------------------------- | ---------- |
| http://admin.localhost:3000/master  | `admin`                       | `admin`    |
| http://demo.localhost:3000/login    | `admin@demo.com`              | `demo1234` |
| http://demo.localhost:3000/login    | `recepcao@demo.com`           | `demo1234` |
| http://demo.localhost:3000/login    | `ana@demo.com` (profissional) | `demo1234` |

A API responde em http://localhost:3001/api. Essas credenciais são só para
desenvolvimento.

| Comando        | O que faz                                                     |
| -------------- | ------------------------------------------------------------- |
| `make up`      | sobe banco, backend e frontend (`make up back` ou `make up front` para um só) |
| `make migrate` | cria e aplica migrations e roda a seed                        |
| `make seed`    | cria os dados de exemplo que ainda não existirem              |
| `make db-down` | para o Postgres (os dados ficam no volume)                    |

Variáveis de ambiente, comandos de cada lado e o passo a passo completo estão
em [ambiente de desenvolvimento](docs/desenvolvimento.md).

## Documentação

A documentação detalhada fica em [`docs/`](docs/README.md): guia de estudo,
multi-tenancy, autenticação, auditoria e LGPD, modelo de dados, guia de rotas
da API, testes e [roadmap](docs/roadmap.md).
