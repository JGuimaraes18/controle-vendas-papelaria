# Plano Técnico — Engenharia de Software, Versionamento e CI (CIVEN)

> **Status:** aguardando aprovação.
> **Data de elaboração:** 2026-11-08
> **Branch analisada:** `main`
> **Commit analisado:** `0f0eb11f5ae207d7006c665af8e779d0180d71db` (`0f0eb11`)
> **Repositório:** `JGuimaraes18/controle-vendas-papelaria`
> **Versão a formalizar:** `v1.0.0`

> Este documento é **apenas um plano**. Nenhum arquivo de aplicação, configuração de deploy, commit, tag, push ou Release foi criado/alterado até a aprovação explícita.

---

## 1. Situação atual (inspeção do repositório)

### 1.1 Git

| Item | Situação |
|---|---|
| Branch atual | `main` |
| Sincronização com remoto | `main` está up-to-date com `origin/main` |
| Working tree | limpo, sem alterações pendentes |
| Tags existentes | **nenhuma** |
| Último commit | `0f0eb11 fix(docker): adjust PostgreSQL dev service configuration` (2026-11-07 23:21:52 -0300) |
| Branches remotas | `main`, `develop`, `feature/commissions`, `feature/customers`, `feature/login` |

### 1.2 Estrutura real

```
/ (raiz)
├── backend/                 # Django + DRF
├── frontend/                # Vite + React + TypeScript + Tailwind
├── docs/                    # existente, porém vazio
├── docker-compose.yml       # produção
├── docker-compose-dev.yml   # desenvolvimento
├── docker-compose-load.yml  # load test
├── Makefile
├── .env.example files       # apenas exemplos versionados
└── README.md
```

### 1.3 Stack efetivamente encontrada

**Backend**
- Python 3.11 (Dockerfiles).
- Django `5.2.14`, Django REST Framework `3.17.1`, SimpleJWT, drf-spectacular.
- PostgreSQL (`psycopg2-binary`), via `DATABASE_URL` ou variáveis `POSTGRES_*`.
- Gunicorn em produção.
- Testes: **213 funções de teste** distribuídas em `backend/apps/*/tests/`.
- Não há `pytest.ini`, `pyproject.toml` de testes ou `setup.cfg`; o runner é o `manage.py test`.

**Frontend**
- **Vite 8** + React 19 + TypeScript + Tailwind CSS v4.
- Testes com **Vitest** + Testing Library.
- Arquivos de teste existentes (5):
  - `src/components/ui/Toast.test.tsx`
  - `src/pages/login/LoginPage.test.tsx`
  - `src/services/authService.test.ts`
  - `src/services/themeService.test.ts`
  - `src/utils/format.test.ts`
- Scripts reais em `frontend/package.json`:
  - `dev`, `build` (`tsc -b && vite build`), `lint` (`eslint .`), `preview`, `test` (`vitest run`), `test:watch`.
- Não existe script `typecheck` nem `format`.

### 1.4 Build, deploy e containers

- **Vercel:** configuração detectada apenas em `frontend/vercel.json`, com rewrites SPA para `index.html`. O projeto provavelmente usa **Root Directory = `frontend`** e preset Vite. Não há workflow de CI nem informações de versão/commit expostas.
- **Render:** não há `render.yaml` no repositório. O backend é containerizado por `backend/Dockerfile.prod`. A configuração do serviço é feita no painel do Render (fora do repositório).
- **Docker:**
  - `docker-compose.yml` (produção): `backend` (Gunicorn) + `frontend` (build Vite + Nginx), com `ARG VITE_API_URL`.
  - `docker-compose-dev.yml` (desenvolvimento): Nginx, Postgres 16, backend com `runserver`, frontend com Vite + hot reload.
  - `backend/Dockerfile.dev` e `backend/Dockerfile.prod`: contexto de build `./backend`.
  - `frontend/Dockerfile.dev` e `frontend/Dockerfile.prod`: contexto de build `./frontend`.
- **Implicação importante:** os contextos de build são independentes (`./backend` e `./frontend`). Um arquivo na raiz do repositório **não** entra automaticamente nas imagens Docker nem no build da Vercel se o Root Directory for `frontend`.

### 1.5 Versionamento atual

- `frontend/package.json` está em `"version": "0.0.0"`.
- `backend/core/settings.py` possui `SPECTACULAR_SETTINGS["VERSION"] = "1.0.0"` **hardcoded** — duplicidade de fonte de verdade.
- Não há `CHANGELOG.md`, tags, Releases, nem exibição de versão na interface.
- Não há `.github/workflows/`.

### 1.6 Segurança e organização

- `.env`, `.env_dev` e `.env_prod` existem localmente, mas **não estão versionados**; apenas `.env_dev_example` e `.env_prod_example` estão no Git. Situação adequada e que será preservada.
- Não há segredos de produção versionados.
- O `README.md` descreve a arquitetura, Docker e execução local, mas não menciona versionamento, releases, rollback ou CI.

---

## 2. Discrepâncias entre o prompt e o repositório

| Prompt | Repositório real | Decisão |
|---|---|---|
| Frontend em **Next.js** | Frontend em **Vite + React** | O plano seguirá o que existe: Vite, `vite build`, `dist`, Vitest e Vercel detectando Vite. Nenhuma migração para Next.js será feita. |
| Frontend/Backend com deploy automático na Vercel/Render | Confirmado por configuração/compose; detalhes ficam nos painéis | Nenhuma alteração de deploy será feita. |
| Versão estável v1.0.0 | Código atual sem tags e `package.json` em `0.0.0` | A `v1.0.0` será formalizada **depois** deste trabalho, no commit que contiver a estrutura de versionamento. |
| "Rodapé do menu principal" | Menu lateral (`frontend/src/components/layout/Sidebar.tsx`) | A identificação será adicionada no rodapé da sidebar, sem alterar o layout existente. |
| Fonte única de versão | Builds independentes e contextos Docker separados | Será usado um `VERSION` canônico na raiz + geração de artefatos para cada contexto, validada pela CI. Ver seção 4. |

---

## 3. Escopo

### 3.1 Dentro do escopo

1. `VERSION` canônico e sincronização para frontend/backend.
2. `CHANGELOG.md` (Keep a Changelog).
3. Documentação de versionamento, releases, CI e rollback em `docs/`.
4. Exibição discreta de versão + commit no rodapé da sidebar.
5. Identificação do commit do frontend via metadados da Vercel.
6. Identificação do commit do backend via metadados do Render + endpoint de diagnóstico.
7. Workflows de CI independentes para backend e frontend.
8. Procedimento de release e tag anotada da `v1.0.0` (sem executar).

### 3.2 Fora do escopo

- Migrar o frontend para Next.js.
- Criar novo mecanismo de deploy ou substituir Vercel/Render.
- Alterar credenciais, `.env`, CORS de produção, banco ou configurações de painel sem necessidade comprovada.
- Refatorar código de aplicação, testes ou arquitetura existente.
- Commits, pushes, tags ou Releases sem autorização explícita.
- Introduzir ferramentas de CI adicionais (Sonar, Codecov, etc.).

---

## 4. Estratégia de versionamento

### 4.1 Fonte de verdade

Criar `VERSION` na raiz do repositório com o conteúdo exato:

```
1.0.0
```

Regras:
- Sem prefixo `v` no arquivo; o prefixo é usado apenas em tags e na interface.
- Formato estrito SemVer: `MAJOR.MINOR.PATCH` (sem pré-release/build metadata no arquivo canônico).
- O arquivo é a **única fonte editada manualmente** em uma release.

Como os contextos de build são independentes, será usado um script de sincronização (`scripts/sync_version.py`, apenas biblioteca padrão) que lê `VERSION` e gera/atualiza:

| Arquivo | Conteúdo |
|---|---|
| `frontend/src/generated/version.ts` | `export const APP_VERSION = "1.0.0";` |
| `backend/core/version_generated.py` | `APP_VERSION = "1.0.0"` |
| `frontend/package.json` | campo `version` |
| `frontend/package-lock.json` | campos `version` e `packages[""].version` |

Os artefatos gerados serão **versionados** (commitados), pois:
- A Vercel faz build com Root Directory `frontend`, sem acesso confiável à raiz.
- O Render faz build com contexto `backend`, sem acesso à raiz.
- Não é necessário alterar Dockerfiles nem configurações de deploy.

A consistência será garantida por `scripts/check_version.py`, executado na CI:
- Valida o formato SemVer do `VERSION`.
- Valida que os artefatos gerados e o `package.json` coincidem.
- Em execução de tag (`v*`), valida que a tag é exatamente `v${VERSION}`.
- Valida que o `CHANGELOG.md` contém uma seção `## [${VERSION}]`.

### 4.2 Regras de incremento

| Tipo | Quando usar | Exemplo |
|---|---|---|
| **MAJOR** | Mudança incompatível de API/comportamento | `1.0.0 → 2.0.0` |
| **MINOR** | Nova funcionalidade compatível | `1.0.0 → 1.1.0` |
| **PATCH** | Correção compatível | `1.0.0 → 1.0.1` |

- Correções podem ser publicadas com PATCH sem criar uma Release editorial a cada commit.
- A Release no GitHub é o marco da versão; o deploy da branch `main` continua sendo o gatilho operacional.
- Uma tag publicada **nunca** é movida ou reutilizada. Histórico não é reescrito.

### 4.3 Fluxo de release

1. Desenvolver em branch específica.
2. Abrir PR para `main`; CI precisa passar.
3. Revisar e integrar (merge).
4. Atualizar `CHANGELOG.md`.
5. Editar `VERSION` conforme SemVer.
6. Executar `python3 scripts/sync_version.py` e commitar os artefatos gerados.
7. Garantir que o commit está na `main` e deployed pela Vercel/Render.
8. Criar tag anotada `vX.Y.Z` no commit deployed.
9. Publicar GitHub Release.
10. Verificar commits em execução nos dois serviços.

> Observação: Vercel e Render fazem deploy da branch `main`; o push de uma tag **não dispara** deploy novo. Por isso a tag deve apontar para um commit que já está na `main` e já foi implantado (ou será implantado pelo fluxo normal de merge).

---

## 5. Estratégia de identificação dos builds

### 5.1 Separação conceitual

- **Versão SemVer (`v1.0.0`)**: versão formal publicada, derivada de `VERSION`.
- **Commit SHA**: código exato em execução em cada serviço, obtido de metadados nativos da plataforma.

Cada serviço pode estar temporariamente em commits diferentes durante um deploy independente. A interface e o endpoint devem refletir o build efetivamente executado, não apenas a última Release.

### 5.2 Frontend (Vercel + Vite)

Em `frontend/vite.config.ts`, resolver o commit em tempo de build com a seguinte prioridade:

1. `VERCEL_GIT_COMMIT_SHA` (Vercel).
2. `VITE_COMMIT_SHA` (build Docker/CI).
3. `GITHUB_SHA` (GitHub Actions).
4. `git rev-parse HEAD` (fallback local, quando `.git` existe).
5. `"dev"` (quando nada está disponível, ex.: build Docker local sem `.git`).

Injetar via `define`:

```ts
__APP_COMMIT__       // SHA completo
__APP_COMMIT_SHORT__ // 7 primeiros caracteres
__APP_ENV__          // production | preview | development | local
```

`__APP_ENV__` prioriza `VERCEL_ENV`; em desenvolvimento local usa `development`/`local`; em produção Docker sem Vercel usa `production`.

Criar `frontend/src/buildInfo.ts`:
- Importa `APP_VERSION` de `frontend/src/generated/version.ts`.
- Exporta `APP_COMMIT`, `APP_COMMIT_FULL`, `APP_ENV`.

Exibição na sidebar (`frontend/src/components/layout/Sidebar.tsx`), no rodapé:
- Expandida: `CIVEN v1.0.0 · a83f91c`
- Colapsada: apenas `v1.0.0`, com `title` contendo versão/commit.
- Classes discretas: `text-[10px]`, `text-slate-400`, `dark:text-slate-500`, `text-center`, `truncate`, `select-none`.
- Sem badges, sem novos componentes, sem alteração do layout responsivo existente.
- Ambiente local: quando o commit não é confiável, exibir `CIVEN v1.0.0 · dev`, evitando simular um build oficial.

Metadados nativos da Vercel usados (sem expor nada sensível):
- `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF` (se necessário).

### 5.3 Backend (Render + Django)

Criar endpoint público e somente leitura:

```
GET /api/version/
```

Resposta sugerida (sem credenciais, sem variáveis de ambiente internas):

```json
{
  "service": "civen-backend",
  "version": "1.0.0",
  "tag": "v1.0.0",
  "commit": "a83f91c",
  "commit_full": "a83f91c...",
  "branch": "main",
  "environment": "production"
}
```

Implementação:
- `backend/core/version.py`: coleta metadados.
  - Commit: `RENDER_GIT_COMMIT` → `GITHUB_SHA` → `GIT_COMMIT_SHA` → `git rev-parse HEAD` (timeout e exceções tratadas) → `""`.
  - Branch: `RENDER_GIT_BRANCH` → `git rev-parse --abbrev-ref HEAD` → `""`.
  - Ambiente: presença de `RENDER`/`RENDER_GIT_COMMIT` → `production`; `DEBUG=True` → `development`; fallback `local`.
  - Versão: `APP_VERSION` de `backend/core/version_generated.py`.
- `backend/core/views.py`: `APIView` com `permission_classes = [AllowAny]`, método `GET` retornando os dados acima.
- `backend/core/urls.py`: `path("api/version/", VersionView.as_view(), name="version")`.
- `backend/core/settings.py`: `SPECTACULAR_SETTINGS["VERSION"]` passa a usar `APP_VERSION`, eliminando a duplicidade hardcoded.

Segurança:
- Não retornar `SECRET_KEY`, `DATABASE_URL`, headers, IPs internos ou qualquer variável sensível.
- O SHA do commit é informação pública de rastreabilidade; a exposição é intencional e de baixo risco.
- O endpoint não acessa banco de dados.

### 5.4 Diagnóstico de divergência

Procedimento documentado:
1. Ver o commit no rodapé do frontend (build Vercel).
2. Ver `GET /api/version/` (build Render).
3. Comparar com os painéis da Vercel e do Render.
4. Se divergirem: um deploy ainda está em andamento ou falhou. Verificar logs; aguardar ou redeployar o serviço atrasado.
5. Confirmar que o commit pertence à `main` e corresponde à tag/Release esperada.

---

## 6. Estratégia de CI (GitHub Actions)

### 6.1 Princípios

- CI valida apenas; **não faz deploy**.
- Dois workflows independentes: `backend-ci.yml` e `frontend-ci.yml`.
- Disparos:
  - `pull_request` com base `main`.
  - `push` em `main`.
- `permissions: contents: read`.
- `concurrency` para cancelar execuções antigas do mesmo ref.
- Actions fixadas em versões estáveis (idealmente SHA completo no momento da implementação).
- Cache de dependências (`pip` e `npm`).
- Nenhum secret de produção. Apenas `SECRET_KEY` fictícia de teste.
- Falha em qualquer verificação retorna status negativo.

> Não serão usados filtros `paths` na primeira versão, para não impedir que checks obrigatórios de PR fiquem pendentes. O `concurrency` evita execuções redundantes.

### 6.2 Workflow de backend

Arquivo: `.github/workflows/backend-ci.yml`

- Runner: `ubuntu-latest`.
- Python: `3.11` (igual aos Dockerfiles).
- Serviço PostgreSQL: `postgres:16-alpine` (igual ao Compose de dev), com healthcheck `pg_isready`.
- Variáveis de ambiente de teste (valores fictícios):
  - `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5432`.
  - Não definir `DATABASE_URL` (usa as variáveis `POSTGRES_*`).
- Passos:
  1. `actions/checkout`.
  2. `actions/setup-python` com cache `pip`.
  3. `python3 scripts/check_version.py`.
  4. `pip install -r backend/requirements.txt`.
  5. `python manage.py check`.
  6. `python manage.py makemigrations --check --dry-run` (verificação de migrations).
  7. `python manage.py test --verbosity=2`.
- `working-directory: backend` nos comandos Django.

> A verificação `makemigrations --check` será validada localmente antes de ser ativada; se houver drift pré-existente fora do escopo, ela será removida ou documentada, sem alterar migrations por conta própria.

### 6.3 Workflow de frontend

Arquivo: `.github/workflows/frontend-ci.yml`

- Runner: `ubuntu-latest`.
- Node: `20` (igual ao `frontend/Dockerfile.prod`).
- Passos:
  1. `actions/checkout`.
  2. `actions/setup-node` com cache `npm` e `package-lock.json`.
  3. `python3 scripts/check_version.py` (Python já disponível no runner).
  4. `npm ci`.
  5. `npm run lint`.
  6. `npx tsc -b` (verificação de tipos usando o `tsc` já instalado).
  7. `npm test` (Vitest).
  8. `npm run build` (produção; já inclui `tsc -b`).
- `working-directory: frontend`.
- Env de build:
  - `VITE_API_URL: http://localhost/api` (valor de CI, não produção).
  - `VITE_COMMIT_SHA: ${{ github.sha }}`.
- `VITE_COMMIT_SHA` alimenta `buildInfo` no build de CI sem depender de valor fixo no código.

### 6.4 O que a CI não fará

- Não publica Release.
- Não cria tag.
- Não faz deploy na Vercel ou Render.
- Não usa banco de produção nem dados reais.
- Não altera painéis ou configurações das plataformas.

---

## 7. Arquivos que serão criados

| Arquivo | Finalidade |
|---|---|
| `VERSION` | Fonte canônica da versão SemVer (`1.0.0`). |
| `CHANGELOG.md` | Histórico no padrão Keep a Changelog, com seção `[1.0.0]`. |
| `scripts/sync_version.py` | Sincroniza `VERSION` com artefatos gerados e `package.json`. |
| `scripts/check_version.py` | Valida consistência, SemVer, tag e CHANGELOG. |
| `frontend/src/generated/version.ts` | Versão gerada para o bundle do frontend. |
| `backend/core/version_generated.py` | Versão gerada para o backend. |
| `frontend/src/buildInfo.ts` | Expõe versão, commit e ambiente ao frontend. |
| `backend/core/version.py` | Coleta metadados de build do backend. |
| `backend/core/views.py` | Endpoint `GET /api/version/`. |
| `.github/workflows/backend-ci.yml` | CI do backend. |
| `.github/workflows/frontend-ci.yml` | CI do frontend. |
| `docs/VERSIONING.md` | SemVer, fonte de verdade, regras de incremento e tags. |
| `docs/RELEASES.md` | Processo de release, verificação, divergências e rollback. |
| `docs/CI.md` | Workflows, comandos locais e limitações. |
| `docs/agents/01_engenharia_de_software_versionamento_plan.md` | Este plano. |

## 8. Arquivos que serão modificados

| Arquivo | Alteração |
|---|---|
| `frontend/src/components/layout/Sidebar.tsx` | Rodapé discreto com `CIVEN vX.Y.Z · <sha>`, responsivo e com `title`. |
| `frontend/vite.config.ts` | `define` de commit/ambiente a partir de Vercel/GitHub/git local. |
| `frontend/package.json` | `version` sincronizada com `VERSION` (via script). |
| `frontend/package-lock.json` | Campos de versão sincronizados (via script). |
| `backend/core/settings.py` | `SPECTACULAR_SETTINGS["VERSION"]` usa `APP_VERSION` gerado. |
| `backend/core/urls.py` | Rota `api/version/`. |
| `Makefile` | Alvos `version-sync` e `version-check`. |
| `README.md` | Seção curta de versão/releases com links para `docs/` e `CHANGELOG.md`. |

Não serão alterados nesta etapa:
- `Dockerfile.dev`/`Dockerfile.prod` (backend e frontend).
- `docker-compose.yml`, `docker-compose-dev.yml`, `docker-compose-load.yml`.
- `frontend/vercel.json`.
- `.env*`, `nginx/`, `loadtest/`.
- Configurações da Vercel e do Render.

---

## 9. CHANGELOG — conteúdo inicial

Estrutura Keep a Changelog:

```markdown
# Changelog

Todas as alterações relevantes deste projeto são documentadas neste arquivo.
O formato segue Keep a Changelog e o versionamento segue Semantic Versioning.

## [Unreleased]

## [1.0.0] - AAAA-MM-DD

### Added
- Autenticação JWT com perfis ADMIN e SELLER.
- Dashboard de vendas e indicadores.
- CRUD de vendas, clientes, produtos e vendedores.
- Controle de estoque e relatório de comissões.
- Filtros, paginação e histórico de vendas.
- Tema claro/escuro e layout responsivo.
- Documentação interativa da API com Swagger.
- Ambientes Docker de desenvolvimento e produção.
- Pipeline de CI para backend e frontend.
- Exibição da versão e do commit no rodapé da aplicação.
- Endpoint de diagnóstico de versão do backend.

### Changed
- Versão da aplicação centralizada em um único arquivo canônico.

### Security
- Configuração de CORS e JWT preservada; nenhum segredo versionado.
```

> A data será a data efetiva da publicação da `v1.0.0`. Nenhuma funcionalidade será inventada; o conteúdo acima reflete apenas o que foi verificado no código.

---

## 10. Documentação em `docs/`

Como `docs/` está vazio, será criada uma organização simples e plana:

- `docs/VERSIONING.md`
  - SemVer, quando usar MAJOR/MINOR/PATCH.
  - Fonte de verdade (`VERSION`) e sincronização.
  - Como criar tag anotada.
  - Como publicar GitHub Release.
  - Como documentar no CHANGELOG.
  - Como identificar a versão em produção/local.
- `docs/RELEASES.md`
  - Passo a passo de release.
  - Verificação de deploy Vercel/Render.
  - Diagnóstico de divergência de commits.
  - Rollback (Vercel, Render, `git revert`, nova PATCH).
  - Regra de nunca mover/reutilizar tags.
- `docs/CI.md`
  - Workflows e gatilhos.
  - Comandos reproduzíveis localmente.
  - Limitações (sem testes E2E, sem deploy pela CI).
- `docs/agents/01_engenharia_de_software_versionamento_plan.md`
  - Este plano.

---

## 11. Possíveis impactos na infraestrutura atual

| Área | Impacto | Mitigação |
|---|---|---|
| **Vercel** | Nenhuma mudança de configuração necessária. O build continua `npm run build`/Vite. O `vercel.json` é preservado. | Apenas leitura de `VERCEL_GIT_COMMIT_SHA`/`VERCEL_ENV` em tempo de build. |
| **Render** | Nenhuma mudança de Dockerfile ou comando. O endpoint lê `RENDER_GIT_COMMIT` em runtime. | Endpoint público, sem banco, sem segredos. |
| **Docker prod** | Sem alteração de contexto/build. Commit local pode aparecer como `dev` quando `.git` não está na imagem. | Documentado como comportamento esperado para build local. |
| **Docker dev** | Nenhuma alteração. Hot reload e portas preservados. | — |
| **Banco de dados** | Nenhuma alteração de schema. CI usa banco efêmero próprio. | `makemigrations --check` validado antes de ativar. |
| **Segurança** | Novo endpoint público de versão/commit. | Sem segredos; somente metadados públicos; `AllowAny` intencional. |
| **CI** | Consumo de minutos do GitHub Actions e serviço PostgreSQL efêmero. | `concurrency`, cache de dependências e dois workflows enxutos. |
| **Frontend** | Pequena alteração visual no rodapé da sidebar. | Texto minúsculo, cores secundárias, `truncate`, sem alterar navegação. |
| **Fontes de versão** | `package.json` deixa de ser `0.0.0` e passa a refletir `VERSION`. | Sincronização automatizada + verificação na CI. |

### 11.1 Pontos que dependem de confirmação manual

1. **Vercel:** confirmar que o Root Directory é `frontend` e que o build é `npm run build` com output `dist`. O plano funciona nesse cenário; se o Root Directory for a raiz, os caminhos gerados continuam válidos, mas o build pode exigir configuração de diretório.
2. **Render:** confirmar que o serviço é Docker com contexto `backend` e que o deploy acompanha a `main`. Não é necessário configurar env nova; `RENDER_GIT_COMMIT` é fornecida pela plataforma.
3. **Proteção de branch:** avaliar (fora deste escopo) exigir os checks `Backend CI` e `Frontend CI` como obrigatórios em PRs para `main`.
4. **Data da Release:** a data do `CHANGELOG` será a data efetiva da publicação.

---

## 12. Riscos e limitações

- Se a Vercel for acionada manualmente/CLI sem integração Git, `VERCEL_GIT_COMMIT_SHA` pode não existir; o fallback será `GITHUB_SHA` ou `dev`.
- Se o Render implantar uma imagem sem metadata Git, `RENDER_GIT_COMMIT` pode não existir; o endpoint retornará `commit` vazio ou derivado de git local, se disponível.
- O fallback `git rev-parse` não funciona dentro das imagens Docker de produção (`.git` não é copiado). Em produção real, os metadados nativos das plataformas são a fonte.
- `frontend/requirements` não existe; o workflow usa `scripts/check_version.py` com o Python já presente no runner.
- `backend/requirements.txt` possui dependências não totalmente fixadas (`dj-database-url`, `gunicorn>=`, `setuptools`). Isso pode causar variação futura na CI; não será alterado neste escopo.
- O `CHANGELOG` inicial não substitui um histórico detalhado de commits; ele reflete funcionalidades verificadas.
- O endpoint `/api/version/` não é autenticado por design. Caso o time prefira restringir, pode-se exigir autenticação, mas isso reduz a capacidade de diagnóstico rápido em produção.

---

## 13. Critérios de aceite e evidências planejadas

| Critério | Evidência planejada |
|---|---|
| Estratégia de SemVer documentada | `docs/VERSIONING.md` + `VERSION` |
| CHANGELOG.md | `CHANGELOG.md` com `[1.0.0]` |
| Documentação de Releases | `docs/RELEASES.md` |
| Versão discreta no rodapé | `Sidebar.tsx` |
| Commit do frontend identificável | `buildInfo.ts` + rodapé |
| Commit do backend identificável | `GET /api/version/` |
| Workflow de CI do backend | `.github/workflows/backend-ci.yml` |
| Workflow de CI do frontend | `.github/workflows/frontend-ci.yml` |
| CI em PRs para `main` | `on.pull_request.branches: [main]` |
| CI em pushes na `main` | `on.push.branches: [main]` |
| Testes/verificações existentes executados | `manage.py test`, `npm test`, `npm run lint`, `tsc -b` |
| Build de produção do frontend validado | `npm run build` |
| Deploy automático da Vercel preservado | Nenhuma alteração em `vercel.json`/painel |
| Deploy automático do Render preservado | Nenhuma alteração no Dockerfile/comando |
| Documentação de como publicar versões | `docs/VERSIONING.md` + `docs/RELEASES.md` |
| Documentação de como identificar versão em produção | `docs/RELEASES.md` + endpoint + rodapé |
| Documentação de rollback | `docs/RELEASES.md` |

---

## 14. Procedimento para formalizar a v1.0.0 (após aprovação e merge)

> Nada abaixo será executado sem autorização explícita.

1. Garantir CI verde no commit final da `main`.
2. Confirmar `VERSION=1.0.0`, artefatos sincronizados e `CHANGELOG` atualizado.
3. Confirmar que Vercel e Render implantaram o commit da `main`.
4. Criar tag anotada no commit já implantado:

```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "CIVEN v1.0.0"
```

5. Publicar a tag (somente após autorização):

```bash
git push origin v1.0.0
```

6. Criar a GitHub Release (somente após autorização):

```bash
gh release create v1.0.0 \
  --title "CIVEN v1.0.0" \
  --notes "Primeira versão estável do CIVEN." \
  --verify-tag
```

Alternativa pela interface do GitHub: **Releases → Draft a new release → tag `v1.0.0` → publicar**.

7. Verificar:
   - Rodapé do frontend: `CIVEN v1.0.0 · <sha>`.
   - `GET /api/version/`: versão, commit, branch e ambiente.
   - Painéis Vercel/Render: commit implantado igual ao da tag.

> **Importante:** se o commit atual `0f0eb11` for considerado o marco congelado antes deste trabalho, a tag `v1.0.0` apontaria para ele. Como este plano adiciona a própria estrutura de versionamento, a recomendação é taguear o commit final deste trabalho na `main`, para que a `v1.0.0` contenha CI, CHANGELOG, documentação e exibição de versão. Essa decisão precisa ser confirmada na aprovação.

---

## 15. Rollback (documentado em `docs/RELEASES.md`)

### 15.1 Rollback operacional imediato

- **Vercel:** usar “Rollback” para o deployment anterior estável no painel.
- **Render:** usar “Rollback”/redeploy do deploy anterior estável no painel.

Esses mecanismos não reescrevem histórico e não movem tags.

### 15.2 Rollback via código

1. Identificar a última versão estável (tag/Release/CHANGELOG).
2. Identificar o commit correspondente.
3. Criar branch de correção e aplicar `git revert` do commit problemático (nunca `reset`/force-push na `main`).
4. Abrir PR, aguardar CI, integrar.
5. Publicar nova PATCH (`vX.Y.Z+1`) com CHANGELOG.
6. Acompanhar deploy automático e validar `/api/version/` e rodapé.

### 15.3 Regras

- Nunca reescrever o histórico da `main`.
- Nunca mover ou reutilizar uma tag publicada.
- Nunca reutilizar o número de uma versão já publicada para outro código.

---

## 16. Ordem de implementação proposta

1. `VERSION`, `scripts/sync_version.py`, `scripts/check_version.py`, artefatos gerados.
2. Ajuste de `backend/core/settings.py` e criação de `version.py`/`views.py`/rota.
3. `frontend/buildInfo.ts`, ajuste de `vite.config.ts` e rodapé da `Sidebar.tsx`.
4. `CHANGELOG.md` e documentação em `docs/`.
5. Workflows de CI.
6. Ajustes de `Makefile` e `README.md`.
7. Execução local de verificação:
   - `python3 scripts/check_version.py`
   - Backend: `python manage.py check` e, se ambiente disponível, `python manage.py test`.
   - Frontend: `npm ci`, `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`.
8. Apresentar resumo, arquivos criados/modificados, resultados e limitações.
9. Somente após autorização: commit, push, tag e Release.

---

## 17. Decisões que precisam da sua aprovação

1. **Escopo do frontend:** manter Vite (real) e ignorar a menção a Next.js do prompt. **(Recomendado.)**
2. **Fonte de verdade:** `VERSION` na raiz + geração versionada para frontend/backend. **(Recomendado.)**
3. **Commit da tag `v1.0.0`:** taguear o commit final deste trabalho (contendo CI, docs e versão visível) ou o commit atual `0f0eb11`. **(Recomendado: commit final deste trabalho.)**
4. **Endpoint `/api/version/`:** público (`AllowAny`) apenas com metadados não sensíveis. **(Recomendado.)**
5. **Rodapé da sidebar:** exibir versão + commit discretamente, com adaptação para sidebar colapsada. **(Recomendado.)**
6. **Data do `CHANGELOG`:** usar a data efetiva da publicação da `v1.0.0`.

---

**Fim do plano.** Aguardando aprovação para iniciar as alterações.
