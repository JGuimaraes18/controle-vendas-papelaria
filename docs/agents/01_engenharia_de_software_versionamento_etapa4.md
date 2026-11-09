# Etapa 4 — Documentação operacional

> **Status:** implementação concluída; aguardando revisão e autorização para a próxima etapa.
> **Data:** 2026-11-08
> **Plano de referência:** `docs/agents/01_engenharia_de_software_versionamento_plan.md`
> **Relatórios anteriores:** `..._etapa1.md`, `..._etapa2.md`, `..._etapa2_1.md` e `..._etapa3.md`

Nenhum commit, push, tag ou Release foi criado. Nenhum workflow, dependência,
Dockerfile, Docker Compose, configuração da Vercel/Render, código de produção ou
migration foi alterado.

---

## 1. Objetivo

Documentar o funcionamento operacional do versionamento, das Releases e da CI,
além de ajustar `README.md` e `Makefile` conforme o plano original.

A documentação foi escrita para refletir o estado **real** do projeto:

- a CI valida localmente, mas **ainda não foi executada no GitHub Actions**;
- Vercel e Render continuam responsáveis pelos deploys;
- `makemigrations --check` está fora da CI por drift pré-existente;
- a semântica UTC x horário local do dashboard permanece pendente.

---

## 2. Arquivos criados

| Arquivo | Conteúdo |
|---|---|
| `docs/VERSIONING.md` | SemVer, `VERSION` como fonte canônica, artefatos derivados, sincronização, validação, exibição da versão e critérios de incremento. |
| `docs/RELEASES.md` | Preparação, validação, tag, publicação de Release, verificação pós-deploy, diagnóstico de divergência e rollback. |
| `docs/CI.md` | Workflows de frontend/backend, gatilhos, verificações, requisitos, execução local, branch protection e limitações. |
| `docs/agents/01_engenharia_de_software_versionamento_etapa4.md` | Este relatório. |

## 3. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `README.md` | Nova seção curta de versionamento/CI/releases com links; correção dos nomes dos arquivos de ambiente; correção do texto sobre produção; inclusão de `make help`. |
| `Makefile` | Novos alvos `version-sync` e `version-check`; implementação do alvo `help` já referenciado por `.DEFAULT_GOAL`; normalização de line endings e remoção de espaços ao final das linhas. |

---

## 4. Decisões tomadas

### 4.1 Fidelidade ao estado atual

Os documentos distinguem claramente:

- o que foi **validado localmente** (`actionlint`, comandos equivalentes à CI);
- o que **ainda não ocorreu** (execução no GitHub Actions);
- o que **não é responsabilidade da CI** (deploy, tag, Release);
- o que está **temporariamente fora da CI** (`makemigrations --check`).

Nenhuma seção afirma que os workflows já passaram no GitHub.

### 4.2 `VERSIONING.md`

- Define `VERSION` como única fonte canônica, sem prefixo `v`.
- Documenta os artefatos gerados e a proibição de edição manual.
- Explica a prioridade de resolução de commit/ambiente no frontend e no backend.
- Registra as regras SemVer e as categorias do Keep a Changelog.
- Deixa explícito que a data do CHANGELOG só é preenchida na publicação.

### 4.3 `RELEASES.md`

- Mantém a ordem: preparar → validar → PR/CI → merge → tag → Release → verificar.
- Reforça que a tag é anotada, criada após o merge e nunca movida/reutilizada.
- Registra que os workflows atuais não disparam em tags; a validação de tag do
  script só ocorre quando a execução tem contexto de tag.
- Inclui verificação pós-deploy via rodapé da sidebar e `GET /api/version/`.
- Inclui rollback operacional (Vercel/Render) e rollback via `git revert` + nova
  PATCH, sem reescrever a `main`.

### 4.4 `CI.md`

- Documenta os dois workflows independentes, com runners, versões, caches,
  timeouts, gatilhos e permissões.
- Lista as actions fixadas por SHA e a política de atualização deliberada.
- Explica o serviço PostgreSQL efêmero e as variáveis fictícias.
- Registra formalmente que `makemigrations --check` está fora da CI por drift
  pré-existente em `accounts`, `customers` e `sellers`.
- Inclui comandos locais para frontend, backend e simulação fiel do serviço de
  PostgreSQL.
- Inclui passo a passo de branch protection no GitHub, deixando claro que a
  configuração é manual e ainda não foi aplicada.

### 4.5 `Makefile`

Foram adicionados apenas alvos relacionados ao escopo:

```bash
make version-sync
make version-check
```

O alvo `help` também foi implementado, pois `.DEFAULT_GOAL := help` já existia,
mas o alvo não estava definido. O arquivo foi normalizado para LF para evitar
espaços residuais no diff.

O alvo `clean`, que já constava em `.PHONY` sem implementação, não foi alterado
nesta etapa para não introduzir remoção destrutiva de artefatos sem escopo
definido.

### 4.6 `README.md`

- Corrigidos os nomes reais dos arquivos de ambiente:
  - `.env_dev_example` → `.env_dev`;
  - `.env_prod_example` → `.env_prod`.
- Corrigido o comentário de `make start-prod` (estava como "modo Dev").
- Adicionada seção curta com:
  - `VERSION` como fonte canônica;
  - comandos `make version-sync` e `make version-check`;
  - rodapé da sidebar e endpoint `GET /api/version/`;
  - links para `docs/VERSIONING.md`, `docs/RELEASES.md`, `docs/CI.md` e
    `CHANGELOG.md`.

---

## 5. Validações executadas

### 5.1 Makefile

```
$ make help
Alvos disponíveis:
  make start-dev      Inicia o ambiente de desenvolvimento
  ...
  make version-check  Valida a consistência da versão

$ make version-check
Validando consistência da versão...
python3 scripts/check_version.py
Versão 1.0.0 consistente em todos os artefatos.

$ make version-sync
Sincronizando artefatos com a versão de VERSION...
python3 scripts/sync_version.py
Versão 1.0.0 já está sincronizada.
```

**Resultado:** aprovado.

### 5.2 Links relativos da documentação

Verificação automatizada dos links relativos em `README.md`,
`docs/VERSIONING.md`, `docs/RELEASES.md` e `docs/CI.md`:

```
links relativos ausentes: nenhum
```

**Resultado:** aprovado.

### 5.3 Whitespace dos arquivos alterados nesta etapa

```
$ git diff --check -- README.md Makefile
exit=0
```

**Resultado:** aprovado. O `Makefile` foi normalizado para LF.

### 5.4 Consistência de versão

```
$ python3 scripts/check_version.py
Versão 1.0.0 consistente em todos os artefatos.
```

**Resultado:** aprovado. Nenhum artefato de versão foi alterado nesta etapa.

### 5.5 Confirmação de escopo

- Nesta etapa, apenas `README.md` e `Makefile` foram alterados; os demais
  arquivos do working tree vêm das etapas anteriores.
- Nenhum arquivo em `.github/workflows/` foi modificado após a Etapa 3.
- Nenhuma alteração em `backend/`, `frontend/src/`, dependências, Dockerfiles,
  Compose, `.env`, Vercel ou Render.
- Nenhuma migration foi criada ou alterada.

**Resultado:** aprovado.

---

## 6. Limitações e pendências

1. **CI ainda não executada no GitHub Actions.**
   A documentação registra explicitamente que a validação foi local; a primeira
   execução real ocorrerá no primeiro PR/push autorizado.

2. **`makemigrations --check` fora da CI.**
   Documentado em `docs/CI.md` e neste relatório. O drift pré-existente não foi
   corrigido.

3. **Branch protection não configurada.**
   `docs/CI.md` contém o passo a passo, mas a configuração é manual no GitHub e
   os checks só aparecem após a primeira execução real.

4. **Semântica UTC x horário local do dashboard.**
   Permanece pendente, conforme aprovado, sem alterações nesta etapa.

5. **Alvo `clean` do Makefile sem implementação.**
   Já existia em `.PHONY`; não foi implementado para evitar remoção destrutiva de
   artefatos sem definição de escopo.

---

## 7. Próxima etapa

Pelo plano original:

- **Etapa 5:** verificação final, commit, push, tag `v1.0.0` e Release — somente
  após autorização explícita.

Aguardo revisão e autorização para prosseguir.
