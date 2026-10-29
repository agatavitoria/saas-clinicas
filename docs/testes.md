# Testes

A CI (`.github/workflows/ci.yml`) roda tudo isto a cada push e pull request
na `main`: lint, testes unitários, e2e (com um Postgres de serviço) e build
do backend, além de lint e typecheck do frontend.

Os testes e2e rodam contra um banco separado, o `saas_clinicas_test`, que o
container cria automaticamente na primeira vez que sobe. Antes de cada
execução, as migrations pendentes são aplicadas nele, e cada teste limpa os
próprios dados. Com o banco no ar (`make db`):

```bash
cd saas-clinicas-backend
npm run test       # unitários
npm run test:e2e   # e2e
```

Os e2e cobrem, entre outros cenários:

- uma clínica não enxerga nem altera dados de outra;
- um token de clínica não abre rotas do master, e vice-versa;
- inativar um usuário ou uma clínica derruba a sessão aberta na hora;
- quem não é administrador não gerencia a equipe;
- a troca de senha provisória é obrigatória;
- uma ação que falha não deixa registro no log, e o log não pode ser alterado;
- o admin só vê o histórico da própria clínica, e os demais usuários não veem
  nada;
- o fluxo completo de exclusão, com logs anonimizados depois da exclusão
  definitiva;
- o Row-Level Security, que barra o acesso a outra clínica mesmo com SQL cru;
- pacientes: o mesmo CPF em clínicas diferentes, permissões por papel,
  imutabilidade do prontuário e o master sem acesso aos dados de saúde.
