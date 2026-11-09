# Changelog

Todas as alterações relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

<!-- A data de [1.0.0] deve ser preenchida com a data efetiva da publicação da Release. -->

## [Unreleased]

## [1.0.0] - AAAA-MM-DD

### Added

- Autenticação stateless com JWT, incluindo acesso e refresh token.
- Controle de acesso por perfis ADMIN e SELLER.
- Dashboard com indicadores de vendas.
- Cadastro, edição, listagem e exclusão de vendas, com filtros e paginação.
- Histórico de alterações e cancelamento de vendas com motivo.
- Cadastro e gestão de clientes.
- Cadastro e gestão de produtos com controle de estoque.
- Cadastro e gestão de vendedores.
- Cálculo e relatório de comissões.
- Perfil de usuário e troca de senha.
- Interface responsiva com tema claro/escuro e paletas de destaque.
- Documentação interativa da API com Swagger.
- Ambientes Docker de desenvolvimento e produção com PostgreSQL.
- Scripts de carga e limpeza de dados para testes de volume.
- Pipeline de integração contínua para backend e frontend.
- Exibição discreta da versão e do commit no rodapé da aplicação.
- Endpoint público de diagnóstico de versão do backend.

### Changed

- Versão da aplicação centralizada no arquivo `VERSION`, com artefatos gerados
  para frontend e backend.
- Versão da documentação OpenAPI sincronizada com a versão canônica do projeto.

### Security

- Credenciais e arquivos `.env` mantidos fora do versionamento.
- Endpoint de versão expõe somente metadados públicos, sem dados sensíveis.

[Unreleased]: https://github.com/JGuimaraes18/controle-vendas-papelaria/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/JGuimaraes18/controle-vendas-papelaria/releases/tag/v1.0.0
