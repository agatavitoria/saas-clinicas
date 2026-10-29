# Autenticação

Existem duas sessões independentes, com as mesmas regras:

|                | Clínica                                  | Admin master                                         |
| -------------- | ---------------------------------------- | ---------------------------------------------------- |
| Login          | `POST /api/auth/login`                   | `POST /api/platform/auth/login`                      |
| Access token   | cookie `access_token` (JWT `aud: tenant`, com usuário e clínica) | cookie `platform_access_token` (JWT `aud: platform`) |
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
- O frontend acessa a API pelo proxy `/api` do próprio Nuxt
  (`server/api/[...path].ts`), para que os cookies fiquem na mesma origem. O
  proxy descarta o `X-Forwarded-For` enviado pelo navegador e informa o IP
  real da conexão, para que ninguém forje o IP gravado na auditoria. As áreas
  logadas renderizam no navegador.
