# Coleção do Insomnia

`saas-clinicas.insomnia.json` traz todas as rotas da API, organizadas em
pastas (Saúde, Clínica e Master), com um ambiente de variáveis.

## Importar

1. Suba o projeto: `make up` na raiz.
2. No Insomnia: **Import** (ou *Create → Import*) → **From File** → escolha
   `insomnia/saas-clinicas.insomnia.json`.
3. Selecione o ambiente **Local** (canto superior esquerdo).

## Variáveis do ambiente

Edite em **Manage Environments**:

| Variável         | Para que serve                                       |
| ---------------- | ---------------------------------------------------- |
| `baseUrl`        | `http://localhost:3001/api`                          |
| `masterLogin` / `masterPassword` | login do master (seed: `admin` / `admin`) |
| `clinicEmail` / `clinicPassword` | login do usuário de clínica          |
| `clinicSlug`                     | endereço da clínica; vai no header `X-Clinic-Slug` do login (seed: `demo`) |
| `newPassword`    | nova senha usada em "Trocar senha"                   |
| `clinicId`       | id da clínica usado nas rotas do master              |
| `clinicName`     | nome exato da clínica (pedido de exclusão)           |
| `userId`         | id do usuário nas rotas de equipe                    |
| `patientId`      | id do paciente                                       |
| `recordId`       | id do atendimento (para adicionar adendo)            |

## Sessão (cookies)

A API usa **cookies httpOnly**, não um header `Authorization`. O Insomnia
guarda os cookies do login e os reenvia sozinho. É só rodar o **Login** da
pasta certa antes das demais chamadas.

- As sessões de clínica e de master usam cookies diferentes e podem ficar
  abertas ao mesmo tempo.
- O access token dura 15 minutos. Quando expirar (`401`), rode **Renovar
  sessão** ou faça login de novo.
- Para limpar os cookies, abra **Cookies** (ao lado do ambiente) e apague-os.

## Roteiro rápido

1. **Master → Autenticação → Login** (`admin` / `admin`).
2. **Master → Clínicas → Criar clínica**. O admin é criado com
   `clinicEmail` / `clinicPassword` do ambiente e a clínica, com o
   `clinicSlug`. Copie o `clinic.id` da resposta para `clinicId`.
3. **Clínica → Autenticação → Login** com o admin criado. A resposta traz
   `mustChangePassword: true`.
4. **Clínica → Autenticação → Trocar senha**. Depois, atualize
   `clinicPassword` no ambiente com o valor de `newPassword`.
5. **Clínica → Equipe → Criar usuário**, e copie o `id` para `userId`.
6. **Clínica → Pacientes → Cadastrar paciente**, e copie o `id` para
   `patientId`. Use um usuário `RECEPTION` ou `ADMIN`.
7. **Clínica → Atendimentos → Registrar atendimento**, com um usuário
   `PROFESSIONAL` ou `ADMIN`.
8. **Clínica → Auditoria → Histórico da clínica** para ver tudo o que foi
   registrado.

## Manter atualizada

Ao criar ou mudar uma rota, atualize a coleção. Pelo Insomnia, edite e
exporte de novo (*Export → Insomnia v4 JSON*) sobre este arquivo.
