# Auditoria e LGPD

## Auditoria

Segue o formato usado no mercado (WorkOS, AWS CloudTrail e o audit log do
GitHub): **eventos explícitos com significado de negócio**.

- **Formato:** `ator · ação · alvo · contexto (IP, user agent) · data · metadata`.
  As ações seguem a convenção `recurso.verbo_no_passado`, por exemplo
  `user.deactivated` ou `clinic.deletion_confirmed`. O catálogo completo está
  em `src/audit/audit-actions.ts`.
- **Na mesma transação:** cada service chama
  `audit.log(tx, 'user.deactivated', { target })` dentro da transação da ação.
  Ou a ação e o registro são gravados juntos, ou nenhum dos dois.
- **Contexto implícito:** ator, IP e user agent vêm do contexto da requisição
  (`nestjs-cls`, que usa AsyncLocalStorage). Ninguém precisa passar esses
  dados por parâmetro.
- **Imutável:** uma trigger no Postgres bloqueia `UPDATE` e `DELETE` em
  `audit_logs`. A única exceção são as rotinas de LGPD, que ligam
  `app.audit_maintenance` só dentro da própria transação.
- **Sem dados pessoais no `metadata`:** só ids, papéis, booleanos e os campos
  alterados.
- **Quem vê:**

  | Quem                    | O que vê                                         |
  | ----------------------- | ------------------------------------------------ |
  | Admin master            | tudo, de todas as clínicas e da plataforma       |
  | Administrador (`ADMIN`) | tudo da **própria** clínica                      |
  | Profissional / Recepção | nada                                             |

## Privacidade (LGPD)

A clínica é a **controladora** dos dados, e a plataforma é a **operadora**. O
sistema dá à clínica as ferramentas para atender os direitos dos titulares.

- **Exportação (portabilidade):** baixa um JSON com a clínica, os horários,
  a equipe (sem hashes de senha) e o histórico de atividades. Cada exportação
  é registrada no log.
  - Feita pelo admin, em `/painel/clinica`, inclui também os pacientes e os
    prontuários.
  - Feita pelo master, traz só a **quantidade** de pacientes, e o nome deles
    aparece como "Paciente" no histórico.
- **Prontuário:** o texto clínico e o CPF nunca vão para o log de auditoria.
  Toda abertura da ficha fica registrada (`patient.viewed`), e as edições
  registram só os **nomes** dos campos alterados.
- **Exclusão em duas etapas:**

  | Situação     | Como chega lá                         | O que acontece                                              |
  | ------------ | ------------------------------------- | ----------------------------------------------------------- |
  | `REQUESTED`  | o admin solicita, digitando o nome da clínica | a clínica segue funcionando; o admin ainda pode desistir |
  | `SCHEDULED`  | o master confirma                     | a exclusão é agendada para daqui a **30 dias** e a clínica fica **somente leitura** |
  | `NONE`       | o master recusa, ou o master ou o admin cancelam | tudo volta ao normal                             |

- **Somente leitura (carência):** a equipe continua entrando e consultando,
  e pode exportar os dados.
  - Qualquer escrita responde `403 CLINIC_READ_ONLY`. As exceções são as rotas
    com `@AllowDuringDeletion()`: trocar a própria senha e cancelar a exclusão.
  - Um aviso no topo do painel mostra quantos dias faltam. O admin vê o botão
    **Cancelar exclusão**; os demais são orientados a falar com ele.

- **Exclusão definitiva:** um job diário (`PurgeService`, às 3h) exclui as
  clínicas cuja carência terminou, numa única transação:
  1. anonimiza os logs da clínica: os nomes viram "Removido" e IP, user agent
     e metadata são apagados;
  2. apaga a clínica, e com ela a equipe, os horários e as sessões;
  3. registra `clinic.purged` como prova de que a exclusão foi feita.
- **Minimização:** IP e user agent são apagados dos logs com mais de
  `AUDIT_IP_RETENTION_DAYS` dias (padrão 180).

> A parte técnica segue a LGPD, mas regras como prazos de retenção, base
> legal e o tratamento de dados de pacientes precisam de validação jurídica.
