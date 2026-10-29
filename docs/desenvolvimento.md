# Ambiente de desenvolvimento

Detalhes de configuração, seed e comandos. O resumo de como rodar está no [README](../README.md#como-rodar).

## Pré-requisitos

- Node.js 24+
- Docker com Docker Compose (por exemplo, o Docker Desktop aberto)
- `make` (já vem no macOS e no Linux)

## 1. Instalar as dependências

Na raiz do repositório:

```bash
make install
```

A raiz não tem `package.json`, então rodar `npm install` nela dá erro. O
`make install` roda o `npm install` dentro de `saas-clinicas-backend/` e de
`saas-clinicas-frontend/`, e a instalação do backend também gera o client do
Prisma.

## 2. Configurar o ambiente do backend

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

## 3. Subir o banco e aplicar as migrations

```bash
make migrate
```

Esse alvo sobe o Postgres, espera ele ficar saudável, aplica as migrations,
regenera o client do Prisma e roda a seed.

## 4. Admin master

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

## 5. Subir a aplicação

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
| `make seed`       | cria o admin master padrão (`admin` / `admin`) e a clínica `demo` |

**Backend** (`saas-clinicas-backend/`)

| Comando                         | O que faz                                     |
| ------------------------------- | --------------------------------------------- |
| `npm run start:dev`             | servidor em modo desenvolvimento              |
| `npm run test`                  | testes unitários                              |
| `npm run test:e2e`              | testes e2e (precisam do Postgres rodando)     |
| `npm run lint`                  | lint                                          |
| `npm run db:seed`               | seed de desenvolvimento (master e clínica `demo`) |
| `npm run platform:create-admin` | cria ou reativa um admin master               |
| `npm run db:studio`             | abre o Prisma Studio para inspecionar o banco |
| `npx prisma generate`           | regenera o client após mudar o schema         |

**Frontend** (`saas-clinicas-frontend/`)

| Comando              | O que faz                         |
| -------------------- | --------------------------------- |
| `npm run dev`        | servidor em modo desenvolvimento  |
| `npm run lint`       | lint                              |
| `npm run typecheck`  | checagem de tipos                 |
