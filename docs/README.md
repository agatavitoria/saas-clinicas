# Documentação

Detalhes do SaaS Clínicas, separados por assunto. A visão geral e o resumo de
como rodar estão no [README](../README.md) da raiz.

| Arquivo | O que tem |
| --- | --- |
| [Guia de estudo](guia-de-estudo.md) | os conceitos de SaaS do projeto, onde cada um está no código, exercícios |
| [Funcionalidades](funcionalidades.md) | o que o sistema faz, por área |
| [Papéis e permissões](permissoes.md) | quem pode o quê: master, admin, recepção e profissional |
| [Multi-tenancy](multi-tenancy.md) | isolamento por `tenantId`, subdomínios, Row-Level Security e o checklist de tabela nova |
| [Autenticação](autenticacao.md) | sessões de clínica e do master, cookies, refresh token |
| [Auditoria e LGPD](auditoria-e-lgpd.md) | log imutável, exportação, exclusão em duas etapas |
| [Modelo de dados](modelo-de-dados.md) | diagrama das tabelas e o papel de cada uma |
| [API](api.md) | guia de rotas, códigos de erro e exemplos de payload |
| [Arquitetura](arquitetura.md) | stack e estrutura de pastas |
| [Ambiente de desenvolvimento](desenvolvimento.md) | variáveis de ambiente, seed, comandos |
| [Testes](testes.md) | como rodar e o que os testes cobrem |
| [Roadmap](roadmap.md) | o que já foi feito e o que falta |

Para testar a API pelo Insomnia, veja [`insomnia/`](../insomnia/README.md).
