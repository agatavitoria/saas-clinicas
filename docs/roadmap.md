# Roadmap

Recursos que um SaaS em produção teria e que ainda serão desenvolvidos. A
ordem é uma sugestão de prioridade. Auditoria e LGPD vêm primeiro porque o
sistema guarda dados de saúde.

- [x] **Auditoria.** Ver [Auditoria e LGPD](auditoria-e-lgpd.md#auditoria). Pendências:
  - [ ] registrar tentativas de login com falha (`auth.login_failed`), só
    para e-mails de usuários existentes. Há um `TODO(audit)` no
    `AuthService`;
  - [x] registrar o acesso a dados de pacientes (`patient.viewed`).
- [x] **LGPD da clínica.** Ver [Auditoria e LGPD](auditoria-e-lgpd.md#privacidade-lgpd).
  Pendências:
  - [ ] anonimização de um usuário a pedido dele;
  - [ ] aceite versionado dos Termos de Uso e do contrato de tratamento de
    dados;
  - [ ] exportação em segundo plano, para clínicas grandes;
  - [ ] LGPD de pacientes: base legal, consentimento e retenção do
    prontuário (20 anos, pela regra do CFM). Dados de saúde são dados
    sensíveis pela lei.
- [x] **Row-Level Security no Postgres.** Ver [Multi-tenancy](multi-tenancy.md#row-level-security-segunda-camada).
- [x] **CI.** GitHub Actions com lint, testes e build a cada push.
- [ ] **Convite por e-mail e recuperação de senha.**
  - Substituir a senha provisória repassada à mão por um link de convite com
    validade.
  - "Esqueci minha senha" com token de uso único.
  - Exige um serviço de envio de e-mail.
- [ ] **Planos e cobrança.**
  - Assinaturas com um provedor de pagamento (Stripe, Asaas etc.).
  - Limites por plano, como número de usuários e de profissionais.
  - Período de teste.
  - Suspensão automática por falta de pagamento, reaproveitando a inativação
    de clínica que já existe.
- [ ] **Observabilidade por tenant.**
  - Logs estruturados com o `tenantId`.
  - Métricas de uso por clínica e alertas.
  - Limite de requisições por clínica, para que uma não sobrecarregue as
    outras.
- [ ] **Personalização por tenant.** Logo, cor principal, subdomínio, fuso
  horário e duração padrão da consulta já existem. Pendências:
  - [ ] textos de lembrete.
- [ ] **Agenda.** Agendamentos, encaixe e status já existem. Pendências:
  - [ ] agenda própria por profissional (dias e horários diferentes dos da
    clínica) e bloqueios, como férias e intervalos;
  - [ ] inativar um paciente ou um profissional cancelar os agendamentos
    futuros dele;
  - [ ] lembretes de consulta para o paciente;
  - [ ] ligar o agendamento realizado ao registro de atendimento no
    prontuário.
