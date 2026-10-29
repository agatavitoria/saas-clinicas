# Multi-tenancy

Como o sistema garante que uma clínica nunca enxergue os dados de outra. O passo a passo para criar uma tabela nova de clínica está no fim deste arquivo.

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

## Subdomínios

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

## Row-Level Security (segunda camada)

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

## Checklist: tabela nova de clínica

1. No `schema.prisma`, a tabela tem `tenantId` com relação para `Clinic`
   (`onDelete: Cascade`) e índices que começam por `tenantId`.
2. Em `src/prisma/tenant-extension.ts`, o modelo entra no mapa
   `TENANT_FIELD`, para o `forTenant` aplicar o filtro.
3. Na migration:
   ```sql
   ALTER TABLE "tabela" ENABLE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON "tabela"
     USING ("tenantId" = app_current_tenant())
     WITH CHECK ("tenantId" = app_current_tenant());

   GRANT SELECT, INSERT, UPDATE ON "tabela" TO app_tenant; -- DELETE só se fizer sentido
   ```
4. No service, todo acesso passa por `prisma.forTenant(tenantId)` ou
   `prisma.tenantTransaction(tenantId, async tx => …)`, com o `tenantId` do
   token.
5. Um teste e2e cria duas clínicas e confere que a segunda não lista, não lê
   e não altera os dados da primeira.

