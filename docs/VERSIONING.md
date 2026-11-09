# Versionamento do CIVEN

Este documento descreve a estratégia de versionamento do CIVEN: fonte canônica,
sincronização dos artefatos, validação, exibição da versão e critérios para
incrementar o número.

O projeto segue [Semantic Versioning 2.0.0](https://semver.org/lang/pt-BR/) e
mantém o histórico em [`CHANGELOG.md`](../CHANGELOG.md), no formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## 1. Fonte canônica

A versão oficial do projeto fica no arquivo [`VERSION`](../VERSION), na raiz do
repositório:

```
1.0.0
```

Regras:

- o arquivo contém apenas `MAJOR.MINOR.PATCH`, sem prefixo `v` e sem sufixo;
- a tag Git correspondente usa o prefixo `v`, por exemplo `v1.0.0`;
- nenhum outro arquivo é fonte de verdade; os demais são derivados ou validados
  a partir dele.

---

## 2. Artefatos derivados

O script [`scripts/sync_version.py`](../scripts/sync_version.py) lê `VERSION` e
atualiza somente campos de versão nos seguintes arquivos:

| Arquivo | Campo atualizado |
|---|---|
| `frontend/src/generated/version.ts` | Constante `APP_VERSION` |
| `backend/core/version_generated.py` | Constante `APP_VERSION` |
| `frontend/package.json` | `version` |
| `frontend/package-lock.json` | `version` e `packages[""].version` |

Os arquivos `frontend/src/generated/version.ts` e
`backend/core/version_generated.py` são gerados e **não devem ser editados
manualmente**. O script preserva o restante do conteúdo, não altera dependências
e informa quais arquivos foram modificados.

### 2.1 Sincronização

A partir da raiz do repositório:

```bash
python3 scripts/sync_version.py
```

Ou, com o Makefile:

```bash
make version-sync
```

Saída esperada quando há alteração:

```
Versão 1.1.0 sincronizada em:
  - frontend/src/generated/version.ts
  - backend/core/version_generated.py
  - frontend/package.json
  - frontend/package-lock.json
```

Quando tudo já está sincronizado:

```
Versão 1.1.0 já está sincronizada.
```

---

## 3. Validação

O script [`scripts/check_version.py`](../scripts/check_version.py) valida:

1. existência e formato SemVer do arquivo `VERSION`;
2. conteúdo exato dos dois artefatos gerados;
3. campo `version` de `frontend/package.json`;
4. campos de versão de `frontend/package-lock.json`;
5. existência da seção `## [MAJOR.MINOR.PATCH]` no `CHANGELOG.md`;
6. coerência da tag Git com `vMAJOR.MINOR.PATCH`, **quando a execução ocorre em
   um contexto de tag** (`GITHUB_REF` iniciando com `refs/tags/` ou
   `GITHUB_REF_TYPE=tag`). Fora desse contexto, a verificação de tag é ignorada.

Execução:

```bash
python3 scripts/check_version.py
```

Ou:

```bash
make version-check
```

Saída de sucesso:

```
Versão 1.0.0 consistente em todos os artefatos.
```

O script retorna código de saída diferente de zero e lista os erros em caso de
divergência. Ele é executado nos dois workflows de CI
(`Frontend CI` e `Backend CI`).

### 3.1 O que a validação não faz

- não verifica se a tag existe no remoto;
- não verifica se a Release foi publicada;
- não substitui a revisão humana do `CHANGELOG.md`;
- não corrige arquivos automaticamente (isso é responsabilidade do
  `sync_version.py`).

---

## 4. Exibição da versão e do commit

### 4.1 Frontend

`frontend/vite.config.ts` resolve o commit em tempo de build, nesta prioridade:

1. `VERCEL_GIT_COMMIT_SHA` (Vercel);
2. `VITE_COMMIT_SHA` (Docker/CI);
3. `GITHUB_SHA` (GitHub Actions);
4. `git rev-parse HEAD` (execução local com `.git` disponível);
5. string vazia, exibida como `dev`.

O ambiente é resolvido por `VERCEL_ENV`, `CI` ou `local`. Os valores são
injetados em `frontend/src/buildInfo.ts` via `define` e exibidos no rodapé da
sidebar:

- expandida: `CIVEN v1.0.0 · 0f0eb11 (local)`;
- colapsada: apenas `v1.0.0`, com o texto completo no atributo `title`.

Em produção na Vercel, o sufixo de ambiente é omitido.

### 4.2 Backend

`backend/core/version.py` resolve:

- **commit:** `RENDER_GIT_COMMIT` → `GITHUB_SHA` → `GIT_COMMIT_SHA` →
  `git rev-parse HEAD`;
- **branch:** `RENDER_GIT_BRANCH` → `GITHUB_HEAD_REF` → `GITHUB_REF_NAME` →
  `git rev-parse --abbrev-ref HEAD`;
- **ambiente:** Render (`production`/`preview`), `VERCEL_ENV`, GitHub Actions
  (`ci`), `DEBUG=True` (`development`) ou `local`;
- **versão:** `APP_VERSION` de `backend/core/version_generated.py`.

O endpoint público `GET /api/version/` retorna apenas metadados não sensíveis:

```json
{
  "service": "civen-backend",
  "version": "1.0.0",
  "tag": "v1.0.0",
  "commit": "0f0eb11",
  "commit_full": "0f0eb11...",
  "branch": "main",
  "environment": "production"
}
```

Quando o commit não está disponível, `commit` retorna `dev` e `commit_full`
retorna string vazia. Builds Docker locais normalmente não incluem `.git`, então
esse fallback é esperado.

---

## 5. Critérios para incrementar a versão

A versão é incrementada na preparação de uma Release, não a cada commit. Durante
o desenvolvimento, as mudanças ficam em `## [Unreleased]` no `CHANGELOG.md`.

| Incremento | Quando usar | Exemplos |
|---|---|---|
| **MAJOR** (`X.0.0`) | Mudança incompatível na API, no formato de dados ou no comportamento público; remoção de funcionalidade. | Remover um endpoint, alterar contrato de resposta, exigir migração manual. |
| **MINOR** (`1.X.0`) | Funcionalidade nova compatível com versões anteriores. | Novo relatório, novo filtro, novo campo opcional. |
| **PATCH** (`1.0.X`) | Correção compatível, sem nova funcionalidade. | Correção de cálculo, ajuste visual, correção de bug. |

Regras complementares:

- se houver mais de uma mudança, prevalece o maior impacto;
- correções de segurança podem ser PATCH ou MINOR, conforme o impacto, e devem
  ser registradas em `Security` no CHANGELOG;
- uma versão publicada nunca é reutilizada nem tem sua tag movida;
- antes de `1.0.0`, a API é considerada instável; o projeto já está em `1.0.0`,
  então as regras acima se aplicam integralmente.

### 5.1 Categorias do CHANGELOG

Use as categorias do Keep a Changelog:

- `Added` — funcionalidades novas;
- `Changed` — mudanças em funcionalidades existentes;
- `Deprecated` — funcionalidades que serão removidas;
- `Removed` — funcionalidades removidas;
- `Fixed` — correções de bugs;
- `Security` — correções de segurança.

A data da seção de versão é preenchida apenas na publicação efetiva da Release.
Até lá, o placeholder `AAAA-MM-DD` permanece.

---

## 6. Fluxo resumido de alteração de versão

1. Definir o incremento SemVer conforme a seção 5.
2. Editar `VERSION`.
3. Atualizar o `CHANGELOG.md`: mover os itens de `Unreleased` para a nova seção
   e ajustar os links de comparação.
4. Executar `make version-sync`.
5. Executar `make version-check`.
6. Rodar as validações locais e a CI (ver [`docs/CI.md`](CI.md)).
7. Seguir o processo de Release em [`docs/RELEASES.md`](RELEASES.md).

---

## 7. Arquivos relacionados

- [`VERSION`](../VERSION)
- [`CHANGELOG.md`](../CHANGELOG.md)
- [`scripts/sync_version.py`](../scripts/sync_version.py)
- [`scripts/check_version.py`](../scripts/check_version.py)
- [`Makefile`](../Makefile)
- [`docs/RELEASES.md`](RELEASES.md)
- [`docs/CI.md`](CI.md)
