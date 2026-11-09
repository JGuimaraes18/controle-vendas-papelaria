# Etapa 1 — Fonte de versão, sincronização e CHANGELOG

> **Status:** implementação concluída; aguardando revisão e autorização para a Etapa 2.
> **Data:** 2026-11-08
> **Plano de referência:** `docs/agents/01_engenharia_de_software_versionamento_plan.md`
> **Versão sincronizada:** `1.0.0`

Nenhum commit, push, tag ou Release foi criado. As alterações estão apenas no
working tree local.

---

## 1. Arquivos criados

| Arquivo | Finalidade |
|---|---|
| `VERSION` | Fonte canônica da versão. Conteúdo: `1.0.0` (sem prefixo `v`). |
| `scripts/sync_version.py` | Lê `VERSION` e sincroniza artefatos gerados, `package.json` e `package-lock.json`. Não altera dependências. |
| `scripts/check_version.py` | Valida SemVer, artefatos gerados, `package.json`, `package-lock.json`, seção do `CHANGELOG` e coerência com tag em contexto de CI. |
| `frontend/src/generated/version.ts` | Versão gerada para uso no frontend (`APP_VERSION`). |
| `backend/core/version_generated.py` | Versão gerada para uso no backend (`APP_VERSION`). |
| `CHANGELOG.md` | Histórico no padrão Keep a Changelog com seção `[1.0.0]`. |

## 2. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `frontend/package.json` | Somente o campo `version`: `0.0.0` → `1.0.0`. |
| `frontend/package-lock.json` | Somente os campos `version` e `packages[""].version`: `0.0.0` → `1.0.0`. |

Nenhuma dependência, script npm, campo de engines ou configuração foi alterado.

Diff resumido:

```
frontend/package-lock.json | 4 ++--
frontend/package.json      | 2 +-
2 files changed, 3 insertions(+), 3 deletions(-)
```

---

## 3. Decisões técnicas tomadas

1. **`VERSION` como fonte única.**
   O arquivo contém apenas `MAJOR.MINOR.PATCH`, sem prefixo `v`. O prefixo é
   aplicado somente em tags, Releases e exibição na interface.

2. **Artefatos gerados versionados no Git.**
   `frontend/src/generated/version.ts` e `backend/core/version_generated.py` são
   commitados porque:
   - a Vercel faz build com Root Directory `frontend`;
   - o Render faz build com contexto `backend`;
   - ambos os contextos são independentes e não acessam a raiz do repositório de
     forma confiável.

   Isso evita alterar Dockerfiles ou configurações de deploy.

3. **Sincronização com biblioteca padrão do Python.**
   `scripts/sync_version.py` não depende de pacotes externos. Ele:
   - valida o formato SemVer;
   - só reescreve arquivos cujo conteúdo mudou (idempotente);
   - preserva a formatação JSON existente (validado antes da alteração: o
     `json.dumps` com `indent=2` reproduz os arquivos byte a byte, exceto pelos
     valores de versão);
   - altera exclusivamente campos de versão, sem tocar em dependências.

4. **Validação automatizada.**
   `scripts/check_version.py` verifica:
   - formato SemVer do `VERSION`;
   - conteúdo exato dos dois artefatos gerados;
   - `version` em `package.json` e `package-lock.json` (incluindo `packages[""]`);
   - existência da seção `## [1.0.0]` no `CHANGELOG`;
   - em contexto de tag (`GITHUB_REF`/`GITHUB_REF_NAME`/`GITHUB_REF_TYPE`), se a
     tag é exatamente `v${VERSION}`.

5. **CHANGELOG com data pendente.**
   Conforme a decisão aprovada, a data deve ser a data efetiva da publicação da
   Release. Como a Release não foi publicada, a seção está como
   `## [1.0.0] - AAAA-MM-DD`, com comentário indicando a substituição no momento
   da publicação.

6. **Plano não alterado.**
   Nenhuma decisão técnica do plano precisou ser modificada nesta etapa.

---

## 4. Validações executadas e resultados

### 4.1 Sincronização

```
$ python3 scripts/sync_version.py
Versão 1.0.0 sincronizada em:
  - frontend/src/generated/version.ts
  - backend/core/version_generated.py
  - frontend/package.json
  - frontend/package-lock.json

$ python3 scripts/sync_version.py
Versão 1.0.0 já está sincronizada.
```

**Resultado:** sincronização correta e idempotente.

### 4.2 Validação de consistência

```
$ python3 scripts/check_version.py
Versão 1.0.0 consistente em todos os artefatos.
```

**Resultado:** aprovado.

### 4.3 Validação de tag

```
$ GITHUB_REF=refs/tags/v1.0.0 GITHUB_REF_NAME=v1.0.0 GITHUB_REF_TYPE=tag \
    python3 scripts/check_version.py
Versão 1.0.0 consistente em todos os artefatos.

$ GITHUB_REF=refs/tags/v1.0.1 GITHUB_REF_NAME=v1.0.1 GITHUB_REF_TYPE=tag \
    python3 scripts/check_version.py
Falha na validação de versão:
  - tag Git: 'v1.0.1' divergente da versão do VERSION ('v1.0.0')
exit=1
```

**Resultado:** aprovado; a validação falha corretamente quando a tag diverge.

### 4.4 Compilação dos scripts e artefato do backend

```
$ python3 -m py_compile scripts/sync_version.py scripts/check_version.py \
    backend/core/version_generated.py
py_compile OK
```

**Resultado:** aprovado.

### 4.5 Build de produção do frontend

Executado em container `node:20-alpine` (mesma versão do
`frontend/Dockerfile.prod`), pois o Node local é 18.19.1 e o projeto exige
Node `^20.19.0 || >=22.12.0`:

```
$ npm run build
vite v8.0.12 building client environment for production...
✓ 1959 modules transformed.
✓ built in 2.56s
```

**Resultado:** aprovado.

### 4.6 Testes do frontend

```
Test Files  5 passed (5)
     Tests  26 passed (26)
```

**Resultado:** aprovado.

### 4.7 Lint do frontend

```
$ npm run lint
✖ 29 problems (28 errors, 1 warning)
```

**Resultado:** falha **pré-existente**, não causada pela Etapa 1.

Detalhes:
- O arquivo gerado `frontend/src/generated/version.ts` não aparece na lista de
  erros; ele está limpo.
- Os erros estão em arquivos já existentes, como `Layout.tsx`,
  `CustomerForm.tsx`, `ProductForm.tsx`, `SaleForm.tsx`, `SellerForm.tsx`,
  `Toast.tsx`, `Pagination.tsx`, listagens de clientes/produtos/vendedores,
  `LoginPage.tsx`, `ProfilePage.tsx`, `CreateSale.tsx`, `EditSale.tsx`,
  `SalesList.tsx`, `authService.ts`, entre outros.
- Regras acionadas: `react-hooks/set-state-in-effect`,
  `react-hooks/immutability`, `react-hooks/purity`,
  `react-refresh/only-export-components`,
  `@typescript-eslint/no-explicit-any`,
  `@typescript-eslint/no-unused-vars` e `react-hooks/exhaustive-deps`.
- O `eslint` resolvido no container é `10.4.0`, compatível com o
  `package.json` (`^10.3.0`), mas o código atual não passa nessas regras.

Essa falha precisa de decisão antes da Etapa 3, pois o plano prevê
`npm run lint` como verificação bloqueante da CI.

---

## 5. Limitações e divergências em relação ao plano

1. **Lint pré-existente bloqueante.**
   A Etapa 3 não conseguirá ter `npm run lint` verde sem uma destas ações:
   - corrigir os 28 erros existentes (fora do escopo atual, pois é refatoração
     de código de aplicação);
   - alterar a configuração do ESLint para rebaixar/desligar regras (reduz a
     qualidade e não é recomendado);
   - marcar o lint como não bloqueante na CI (também não é recomendado).

   **Recomendação:** manter o lint bloqueante e tratar as correções em escopo
   separado, ou aprovar explicitamente uma das alternativas antes da Etapa 3.
   Nenhuma dessas ações foi executada nesta etapa.

2. **CHANGELOG com data placeholder.**
   `## [1.0.0] - AAAA-MM-DD` será substituído pela data efetiva no momento da
   publicação da Release, conforme aprovado.

3. **Node local x Node do projeto.**
   O ambiente local possui Node 18.19.1, abaixo do exigido pelo Vite 8. As
   validações de frontend foram feitas em `node:20-alpine`, alinhado ao
   Dockerfile de produção e ao que será usado na CI. O `node_modules` local
   estava vazio; a instalação foi feita em volume Docker separado, sem afetar o
   repositório.

4. **Sem alterações de infraestrutura.**
   Nenhum Dockerfile, Compose, `vercel.json`, `.env` ou configuração de painel
   foi modificada.

---

## 6. Arquivos no working tree após a Etapa 1

Modificados:
- `frontend/package.json`
- `frontend/package-lock.json`

Criados:
- `VERSION`
- `CHANGELOG.md`
- `scripts/sync_version.py`
- `scripts/check_version.py`
- `frontend/src/generated/version.ts`
- `backend/core/version_generated.py`
- `docs/agents/01_engenharia_de_software_versionamento_etapa1.md`

---

## 7. Próxima etapa

**Etapa 2:** identificação de versão e commit no frontend e backend:
- `frontend/vite.config.ts` e `frontend/src/buildInfo.ts`;
- rodapé da `Sidebar.tsx`;
- `backend/core/version.py`, `backend/core/views.py` e rota `GET /api/version/`;
- ajuste de `SPECTACULAR_SETTINGS["VERSION"]`.

Aguardo revisão e autorização para iniciar a Etapa 2.
