# Funcionalidades

O que o sistema já faz, por área. O que ainda falta está no [roadmap](roadmap.md).

**Disponível**

- **Endereço por clínica:** cada clínica tem um subdomínio próprio
  (`sorriso.dominio.com`), definido na criação e fixo depois. O login já
  abre com o nome, a cor e o logo dela, e só aceita usuários daquela clínica.
  O master fica em `admin.dominio.com`, e o domínio raiz só pergunta o
  endereço da clínica.
- **Admin master (plataforma)**, em `admin.<domínio>/master`:
  - cria clínicas (dados, endereço, horário de funcionamento e administrador);
  - lista, ativa e inativa clínicas;
  - cadastra, inativa e redefine a senha dos usuários de qualquer clínica.
- **Administrador da clínica**, em `/painel/equipe`:
  - cadastra usuários da própria clínica;
  - inativa e reativa usuários;
  - redefine senhas.
- **Senha provisória:** todo usuário novo, ou com senha redefinida, entra com
  uma senha provisória e é obrigado a trocá-la no primeiro acesso.
- **Login** com sessão em cookies httpOnly, renovação automática e logout.
  Inativar um usuário ou uma clínica derruba o acesso na hora.
- **Painel da clínica:** dados de contato, status "aberta agora", horário da
  semana e equipe.
- **Pacientes**, em `/painel/pacientes`:
  - cadastro com busca por nome ou CPF. O CPF é único dentro da clínica, e o
    mesmo CPF em outra clínica é um cadastro independente;
  - ficha do paciente;
  - **prontuário**: registros de atendimento imutáveis, com adendos para
    correções.
- **Agenda**, em `/painel/agenda`:
  - visão de dia (uma coluna por profissional) e de semana, com o horário de
    funcionamento em destaque e a linha do "agora";
  - agendamento com paciente, profissional, data, hora e duração (sugerida
    pela duração padrão da clínica). Clicar num horário vazio já preenche o
    profissional e a hora;
  - o mesmo profissional nunca tem dois horários sobrepostos (trava no banco,
    vale também para marcações simultâneas);
  - fora do horário de funcionamento, a tela avisa e permite marcar como
    **encaixe**;
  - status: agendado, confirmado, cancelado (com motivo), realizado e faltou.
    Remarcar volta para "agendado";
  - horários sempre no fuso da clínica, configurável em `/painel/clinica`.
- **Auditoria:** histórico imutável de quem fez o quê e quando. O admin vê o
  da própria clínica, em `/painel/atividades`; o master vê o de toda a
  plataforma, em `/master/atividades`.
- **LGPD:**
  - exportação de todos os dados da clínica;
  - exclusão em duas etapas (o admin solicita e o master confirma), com 30
    dias de carência. Nesse período o sistema fica somente para consulta,
    mostra quantos dias faltam e o admin pode cancelar. Depois, o histórico é
    mantido de forma anônima;
  - IP apagado dos logs depois de 180 dias.
- **Personalização**, em `/painel/clinica` (admin) e na clínica em `/master`:
  - nome da clínica;
  - cor principal escolhida numa paleta ou livre, com contraste mínimo de
    4,5:1 com o branco (WCAG AA);
  - logo em PNG, JPG ou WebP, com até 512 KB, exibido no menu do painel e
    na tela de login.
