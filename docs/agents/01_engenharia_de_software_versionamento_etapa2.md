# Etapa 2 — Identificação de versão e commit (frontend e backend)

> **Status:** implementação concluída; aguardando revisão e autorização para a Etapa 3.
> **Data:** 2026-11-08
> **Plano de referência:** `docs/agents/01_engenharia_de_software_versionamento_plan.md`
> **Relatório anterior:** `docs/agents/01_engenharia_de_software_versionamento_etapa1.md`

Nenhum commit, push, tag ou Release foi criado. Nenhum Dockerfile, Docker Compose,
`vercel.json`, `.env` ou configuração de painel da Vercel/Render foi alterado.

---

## 1. Arquivos criados

| Arquivo | Finalidade |
|---|---|
| `frontend/src/buildInfo.ts` | Expõe versão, commit curto/completo e ambiente para o frontend. |
| `backend/core/version.py` | Resolve commit, branch e ambiente do backend a partir de metadados nativos (Render/GitHub/git) e da versão gerada. |
| `backend/core/views.py` | Implementa `VersionView` e o serializer OpenAPI do endpoint de versão. |
| `docs/agents/01_engenharia_de_software_versionamento_etapa2.md` | Este relatório. |

## 2. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `frontend/vite.config.ts` | Resolve commit/ambiente em tempo de build e injeta via `define`. |
| `frontend/src/components/layout/Sidebar.tsx` | Rodapé discreto com versão e commit, adaptado aos estados expandido/colapsado. |
| `backend/core/settings.py` | `SPECTACULAR_SETTINGS["VERSION"]` passa a usar `APP_VERSION` gerado. |
| `backend/core/urls.py` | Adiciona `GET /api/version/`. |

Nenhuma dependência, script npm, Dockerfile ou configuração de infraestrutura foi modificada.

---

## 3. Decisões técnicas

### 3.1 Frontend — resolução do commit

Em `frontend/vite.config.ts`, a prioridade é:

1. `VERCEL_GIT_COMMIT_SHA` (Vercel);
2. `VITE_COMMIT_SHA` (Docker/CI);
3. `GITHUB_SHA` (GitHub Actions);
4. `git rev-parse HEAD` (fallback local quando `.git` está disponível);
5. string vazia, convertida para `dev` na interface.

Os valores são injetados em tempo de build por `define`:

- `__APP_COMMIT__` (SHA completo);
- `__APP_COMMIT_SHORT__` (7 caracteres);
- `__APP_ENV__` (`VERCEL_ENV`, `ci` ou `local`).

Nada é lido em runtime no navegador e nenhuma variável sensível é exposta.

### 3.2 Frontend — exibição na sidebar

Em `Sidebar.tsx`, o rodapé exibe:

- **Expandida:** `CIVEN v1.0.0 · 0f0eb11 (local)` (em produção: `CIVEN v1.0.0 · a83f91c`);
- **Colapsada:** apenas `v1.0.0`, com `title` contendo o texto completo.

Classes usadas: `text-[10px]`, `text-slate-400`, `dark:text-slate-500`, `text-center`,
`leading-tight`, `truncate` e `select-none`. O layout, a navegação e a
responsividade existentes foram preservados. O sufixo de ambiente evita simular
um build oficial de produção em desenvolvimento local.

### 3.3 Backend — resolução de metadados

`backend/core/version.py` resolve:

- **Commit:** `RENDER_GIT_COMMIT` → `GITHUB_SHA` → `GIT_COMMIT_SHA` → `git rev-parse HEAD` (timeout de 2s e exceções tratadas);
- **Branch:** `RENDER_GIT_BRANCH` → `GITHUB_HEAD_REF` → `GITHUB_REF_NAME` → `git rev-parse --abbrev-ref HEAD`;
- **Ambiente:** `RENDER` (production/preview) → `VERCEL_ENV` → `GITHUB_ACTIONS=ci` → `DEBUG` → `local`;
- **Versão:** `APP_VERSION` de `backend/core/version_generated.py`.

Quando não há commit disponível, o campo curto retorna `dev` e `commit_full`
retorna string vazia.

### 3.4 Backend — endpoint público

`GET /api/version/`:

- `authentication_classes = []` e `permission_classes = [AllowAny]`;
- não acessa banco de dados;
- retorna somente metadados públicos:

```json
{
  "service": "civen-backend",
  "version": "1.0.0",
  "tag": "v1.0.0",
  "commit": "abcdef1",
  "commit_full": "abcdef1234567890",
  "branch": "main",
  "environment": "production"
}
```

Não são expostas credenciais, variáveis de ambiente, hosts internos,
`SECRET_KEY`, `DATABASE_URL`, headers ou qualquer detalhe de infraestrutura.

Foi adicionado um `VersionSerializer` com `@extend_schema` para que a
documentação OpenAPI descreva a resposta corretamente, sem warnings novos na
geração do schema.

### 3.5 Django Spectacular

`SPECTACULAR_SETTINGS["VERSION"]` deixou de ser hardcoded e passou a usar
`APP_VERSION`, eliminando a duplicidade de fonte de versão apontada no plano.

### 3.6 Preservação de infraestrutura

Não foi necessário alterar Dockerfiles, Compose, Vercel ou Render:

- Vercel continua fazendo build Vite em `frontend` e injeta os metadados nativos;
- Render continua usando o Dockerfile atual e fornece `RENDER_GIT_COMMIT` em runtime;
- o fallback local funciona quando o repositório com `.git` está disponível.

---

## 4. Validações executadas e resultados

### 4.1 Frontend — lint dos arquivos alterados

```
$ npx eslint src/buildInfo.ts src/components/layout/Sidebar.tsx src/generated/version.ts
(sem saída de erro)
```

**Resultado:** aprovado. O lint global continua com falhas pré-existentes, fora do
escopo desta etapa (ver seção 5).

### 4.2 Frontend — build de produção

Executado em container `node:20-alpine` (mesma versão do Dockerfile de produção):

```
$ npm run build
vite v8.0.12 building client environment for production...
✓ 1961 modules transformed.
✓ built in 2.64s
```

**Resultado:** aprovado.

### 4.3 Frontend — testes

```
Test Files  5 passed (5)
     Tests  26 passed (26)
```

**Resultado:** aprovado.

### 4.4 Frontend — injeção de metadados da Vercel

Build simulado com:

```
VERCEL_ENV=production
VERCEL_GIT_COMMIT_SHA=abcdef1234567890
```

Verificações no bundle:

```
commit encontrado: abcdef1
sufixo production ausente: SIM
```

**Resultado:** aprovado. O commit nativo da Vercel é injetado e o ambiente de
produção não recebe sufixo visual.

### 4.5 Backend — compilação e system check

```
$ python3 -m py_compile backend/core/version.py backend/core/views.py
py_compile OK

$ python manage.py check
System check identified no issues (0 silenced).
```

**Resultado:** aprovado.

### 4.6 Backend — endpoint em ambiente local

Executado em container `python:3.11` com PostgreSQL de teste disponível para o
suite completo. Para o endpoint, o retorno local foi:

```
STATUS_LOCAL 200
BODY_LOCAL {
  'service': 'civen-backend',
  'version': '1.0.0',
  'tag': 'v1.0.0',
  'commit': 'dev',
  'commit_full': '',
  'branch': '',
  'environment': 'local'
}
```

**Resultado:** aprovado. O container de validação monta apenas `backend/`, sem
`.git`, por isso o fallback local aparece como `dev`/vazio. Na execução local
normal, a partir do repositório completo, o git resolve commit e branch.

### 4.7 Backend — endpoint simulando Render

```
RENDER=true
IS_PULL_REQUEST=false
RENDER_GIT_COMMIT=abcdef1234567890
RENDER_GIT_BRANCH=main
```

Retorno:

```
STATUS_RENDER 200
BODY_RENDER {
  'service': 'civen-backend',
  'version': '1.0.0',
  'tag': 'v1.0.0',
  'commit': 'abcdef1',
  'commit_full': 'abcdef1234567890',
  'branch': 'main',
  'environment': 'production'
}
```

**Resultado:** aprovado. O commit implantado no Render é refletido corretamente e
o ambiente é identificado como produção.

### 4.8 Backend — versão do Spectacular e schema OpenAPI

```
SCHEMA_VERSION 1.0.0
spectacular exit=0
```

O schema gerado contém:

```
/api/version/:
  get:
    operationId: api_version_retrieve
    security:
    - {}
    responses:
      '200':
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Version'
```

**Resultado:** aprovado. O endpoint é público no schema (`security: [{}]`), tem
resposta documentada e não gera novo warning de `VersionView`.

### 4.9 Backend — suite completa

Executada com PostgreSQL 16 (mesma imagem do ambiente de dev):

```
Ran 213 tests in 347.907s
FAILED (failures=1)
```

**Resultado:** 212 testes passam; 1 falha **pré-existente e fora do escopo**:

```
FAIL: test_summary_considers_period_filter
(apps.sales.tests.test_dashboard.DashboardEndpointTest)
AssertionError: 0 != 2
```

O teste cria vendas com `timezone.now()` e `days_ago=10`, mas consulta um período
fixo de `2026-09-01` a `2026-09-30`. Como a data atual é `2026-11-08`, as vendas
não pertencem ao período consultado. O teste é dependente da data e não tem
relação com as alterações desta etapa (não foram tocados dashboard, vendas ou
modelos). Não foi corrigido para respeitar a diretriz de não misturar correções
pré-existentes ao escopo.

---

## 5. Limitações e divergências

1. **Lint global do frontend continua falhando.**
   A Etapa 1 já registrou 28 erros pré-existentes em arquivos não alterados. Nesta
   etapa foram validados apenas os arquivos criados/modificados, que passam sem
   erros. A decisão sobre como tratar o lint na Etapa 3 permanece pendente.

2. **Falha de teste pré-existente no dashboard.**
   `test_summary_considers_period_filter` depende de datas fixas de setembro de
   2026. Recomenda-se corrigi-lo em tarefa separada (ex.: calcular o período a
   partir de `timezone.localdate()`), sem misturar com o escopo de versionamento.

3. **Metadados locais em Docker.**
   Builds Docker locais não incluem `.git`; nesse caso o frontend exibe
   `dev (local)` e o backend retorna `commit=dev`. Em produção, Vercel e Render
   fornecem os metadados nativos. Esse comportamento é esperado e não exige
   alteração de Dockerfile.

4. **Dependência de metadados nativos.**
   Se a Vercel ou o Render forem acionados por mecanismos sem integração Git, os
   campos de commit podem ficar vazios/`dev`. O fallback por variável de ambiente
   (`VITE_COMMIT_SHA`/`GIT_COMMIT_SHA`) permite corrigir isso sem alterar código.

5. **Data do CHANGELOG.**
   Permanece `AAAA-MM-DD`, conforme aprovado, até a publicação efetiva da Release.

---

## 6. Arquivos no working tree após a Etapa 2

Modificados:
- `backend/core/settings.py`
- `backend/core/urls.py`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/vite.config.ts`
- `frontend/package.json` (Etapa 1)
- `frontend/package-lock.json` (Etapa 1)

Criados:
- `backend/core/version.py`
- `backend/core/views.py`
- `frontend/src/buildInfo.ts`
- `VERSION` (Etapa 1)
- `CHANGELOG.md` (Etapa 1)
- `scripts/sync_version.py` (Etapa 1)
- `scripts/check_version.py` (Etapa 1)
- `frontend/src/generated/version.ts` (Etapa 1)
- `backend/core/version_generated.py` (Etapa 1)
- `docs/agents/01_engenharia_de_software_versionamento_plan.md`
- `docs/agents/01_engenharia_de_software_versionamento_etapa1.md`
- `docs/agents/01_engenharia_de_software_versionamento_etapa2.md`

---

## 7. Próxima etapa

**Etapa 3:** workflows independentes de CI para backend e frontend.

Ponto pendente de decisão antes da Etapa 3:

- o `npm run lint` global falha por 28 erros pré-existentes. Para a CI ficar verde,
  será necessário corrigir esses erros em escopo separado, ajustar regras do
  ESLint ou aprovar explicitamente outra estratégia.

Aguardo revisão e autorização para prosseguir.
