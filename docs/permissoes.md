# Papéis e permissões

| Quem                    | Onde entra        | O que pode fazer                                            |
| ----------------------- | ----------------- | ----------------------------------------------------------- |
| Admin master            | `admin.<domínio>/master/login` | todas as clínicas e os usuários delas          |
| Administrador (`ADMIN`) | `<slug>.<domínio>/login` | tudo na **própria** clínica: equipe, pacientes, prontuário, histórico e LGPD |
| Recepção (`RECEPTION`)  | `<slug>.<domínio>/login` | cadastra e edita pacientes; consulta o prontuário    |
| Profissional (`PROFESSIONAL`) | `<slug>.<domínio>/login` | consulta pacientes e registra atendimentos e adendos |

Um usuário pode ter **vários papéis**, por exemplo administrador e
profissional ao mesmo tempo, e as permissões somam. O admin define os papéis
em **Equipe → Editar papéis**. Ninguém tira o próprio papel de admin, e a
clínica nunca fica sem um admin ativo. Os papéis não vão no token: o backend
lê do banco a cada requisição, então uma mudança vale na hora.

Permissões sobre pacientes:

| Ação                                     | Recepção | Profissional | Admin |
| ---------------------------------------- | :------: | :----------: | :---: |
| Listar, buscar e abrir a ficha           | ✅       | ✅           | ✅    |
| Cadastrar, editar e inativar paciente    | ✅       | ❌           | ✅    |
| Ver os atendimentos                      | ✅       | ✅           | ✅    |
| Registrar atendimento                    | ❌       | ✅           | ✅    |
| Adicionar adendo                         | ❌       | só no próprio registro | ✅ |

Permissões na agenda:

| Ação                                        | Recepção | Profissional | Admin |
| ------------------------------------------- | :------: | :----------: | :---: |
| Ver a agenda de todos                       | ✅       | ✅           | ✅    |
| Agendar, remarcar e cancelar                | ✅       | só na própria agenda | ✅ |
| Confirmar, marcar realizado ou falta        | ✅       | só na própria agenda | ✅ |

O admin master **não vê dados de pacientes**: só a quantidade por clínica. Na
LGPD, a clínica é a controladora dos dados de saúde.

O admin master não pertence a nenhuma clínica. Ele fica em uma tabela
própria (`platform_admins`) e tem sessão separada, com cookies diferentes.
Um token de clínica nunca abre uma rota do master, e vice-versa.
