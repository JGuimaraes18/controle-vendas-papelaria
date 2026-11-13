# Auditoria Técnica – Projeto CIVEN — Plano de Atualização de Versões

- **Data da auditoria:** 2026-11-12
- **Escopo:** exclusivamente diagnóstico (nenhuma alteração foi aplicada ao projeto)
- **Ferramentas de auditoria utilizadas:**
  - Frontend: `npm audit` (npm 10.9.9, sobre o `package-lock.json` vigente)
  - Backend: `pip-audit` (sobre `backend/requirements.txt`)
  - Verificação de versões disponíveis: `npm view` / `pip index versions`
- **Ambiente de execução da auditoria:** Node.js v22.23.3, npm 10.9.9, Python 3.10.12 (host); Python 3.11 (Dockerfile e CI)

> **Nota de transparência:** todas as versões "atual" foram lidas dos artefatos do
> repositório (`package.json`/`node_modules`, `requirements.txt`, `Dockerfile*`,
> `docker-compose*.yml`, workflows da CI). Nenhum valor foi presumido. Quando uma
> informação não pôde ser verificada, isso está explicitamente sinalizado.

---

## A. Resumo executivo

O projeto CIVEN (v1.0.0) é uma aplicação full-stack: **React 19 + TypeScript + Vite 8 +
TailwindCSS 4** no frontend e **Django 5.2 + DRF + SimpleJWT + PostgreSQL** no backend,
empacotados em Docker (nginx + gunicorn) com deploy em Vercel (frontend) e Render
(backend), segundo o README.

**Situação geral: o projeto está significativamente defasado e com vulnerabilidades
ativas em ambas as camadas.**

- **Frontend:** `npm audit` reportou **27 vulnerabilidades (12 high, 14 moderate, 1 low)**.
  Dependências *diretas* afetadas: `axios`, `react-router-dom`/`react-router`, `vite`,
  `postcss`. Diversas vulnerabilidades *indiretas* (undici, browserslist, zod,
  follow-redirects, source-map-js, brace-expansion, nanoid, form-data) exigem atualização
  dos pacotes raiz para serem resolvidas.
- **Backend:** `pip-audit` reportou vulnerabilidades em **4 pacotes**: `Django`
  (10 advisories), `djangorestframework` (5 advisories, 3 CVEs), `PyJWT` (16 advisories)
  e `sqlparse` (5 advisories). O `PyJWT` é a biblioteca central de autenticação (via
  SimpleJWT) — o componente de maior sensibilidade.
- **Incompatibilidades de runtime já identificadas:**
  1. `vite@8.0.12` exige `node ^20.19.0 || >=22.12.0`; a CI usa **Node 20** e o Dockerfile
     usa **node:20-alpine** — risco de incompatibilidade.
  2. `vitest@4.1.11` (instalado) exige `node ^22.12.0 || ^24.0.0 || >=26.0.0` — **incompatível
     com Node 20**.
  3. O venv local em `backend/env` foi criado com **Python 3.10.12**, enquanto Dockerfile e
     CI usam **3.11**.
  4. `typescript-eslint` (devDependency) declara suporte a `typescript >=4.8.4 <6.1.0` — o
     `typescript@~6.0.2` (6.0.3 instalado) está no limite superior suportado; subida para
     TS >= 6.1 quebra o lint.
- **Gaps de configuração de produção (backend):** ausentes `SECURE_SSL_REDIRECT`,
  `SECURE_HSTS_*`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`.
  O JWT é armazenado em `localStorage` no frontend (risco amplificado por XSS).

**Principais riscos, em ordem:** (1) PyJWT com 16 advisories não corrigidos na camada de
autenticação; (2) Django/DRF com vulnerabilidades de cache poisoning/DoS com exploração
remota; (3) `vite`/`postcss`/`axios`/`react-router` com advisories high; (4)
desalinhamento de versões de runtime Node/Python entre CI, Docker e ambiente local.

---

## B. Frontend

**Framework:** React 19 (SPA) + TypeScript + Vite 8 + TailwindCSS 4.
**Gerenciador de pacotes:** npm 10.9.9 (lock: `package-lock.json`).
**Node:** CI = 20; Docker build = `node:20-alpine`; host da auditoria = v22.23.3.
**Compatibilidade exigida pelas dependências atuais:** `vite@8` -> `^20.19.0 || >=22.12.0`;
`vitest@4.1.11` -> `^22.12.0 || ^24.0.0 || >=26.0.0`. **Recomendado: Node 22 LTS.**

### B.1 Dependências diretas

| Dependência | Versão atual | Versão recomendada | Severidade | Motivo da atualização |
|---|---|---|---|---|
| axios | 1.16.1 | >= 1.18.0 (latest 1.21.1) | **Alta** | Prototype pollution com injeção de Basic auth (GHSA-xj6q-8x83-jv6g); prototype pollution na construção de request (GHSA-mmx7-hfxf-jppx); DoS em `formToJSON` (GHSA-pmv8-rq9r-6j72); bypass de `maxBodyLength` via HTTP/2 (GHSA-mwf2-3pr3-8698); proxy herdado após clonagem de config em Node (GHSA-gcfj-64vw-6mp9, high) |
| react-router-dom | 7.15.1 | >= 7.18.2 (latest 7.18.5) | **Alta** | Em `react-router`: open redirect via backslash em `<Link>`/`useNavigate` (bypass de CVE-2025-68470, GHSA-wrjc-x8rr-h8h6); XSS via RSCErrorHandler (GHSA-h8fp-f39c-q6mh); injeção de construtor em `deserializeErrors()` SSR (GHSA-337j-9hxr-rhxg); DoS nao autenticado via matching de rotas (GHSA-chx6-hx7r-mcp5, high); bypass CSRF em RSC mode (GHSA-qwww-vcr4-c8h2, high) |
| vite | 8.0.12 (pin exato) | >= 8.1.6 (latest 8.3.8) | **Alta** | 7 advisories: execução arbitraria de comando via flags de editor (GHSA-r825-w8mm-5pxw); disclosure NTLMv2 via UNC (GHSA-v6wh-96g9-6wx3); bypass `fs.existsSync` (GHSA-587h-7wmj-h5pm, high); cross-origin script execution via middleware (GHSA-9jrq-w75r-8gcw); bypass de `server.fs.deny`/`allow` (GHSA-fx2h-pf6j-xcff, GHSA-rq7h-c2jc-7f22) |
| react | 19.2.6 | 19.3.1 | Sem advisory | Manutenção/hotfix; sem vulnerabilidade conhecida reportada |
| react-dom | 19.2.6 | 19.3.1 | Sem advisory | Manter em paridade com `react` |
| dayjs | 1.11.20 | 1.11.23 | Sem advisory | Manutenção |
| lucide-react | ^1.16.0 (package.json) / **1.43.0 instalado (divergente)** | >= 1.72.0 | Sem advisory | Atualização de ícones; **atenção: versão instalada difere do range declarado — validar antes de atualizar** |
| @types/react-router-dom (dev) | ^5.3.3 | **remover** | Baixa (higiene) | Pacote obsoleto para React Router v7 (tipos vêm do próprio pacote); versão 5 incompatível com o router v7 em uso |

### B.2 Dependências de desenvolvimento

| Dependência | Versão atual | Versão recomendada | Severidade | Motivo da atualização |
|---|---|---|---|---|
| postcss | 8.5.14 | >= 8.5.23 | **Alta** | Path traversal na auto-carga de `sourceMappingURL` permitindo leitura arbitraria de arquivos `.map` (GHSA-r28c-9q8g-f849, high); correção incompleta de GHSA-6g55-p6wh-862q (GHSA-fxqj-rqcc-2cmp) |
| vitest | 4.1.11 | >= 4.1.12 (latest 5.1.0) | Media | Via `@vitest/mocker` (<=4.1.11). **Cuidado:** vitest 5.1.0 exige Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| eslint | 10.4.0 | 10.14.0 | Media | Via `@eslint/config-array` (>=0.23.0) e `minimatch` (7.0.0–11.0.0) |
| @eslint/js | 10.0.1 | 10.x (>=10.0.2) | Media | Mesmo vetor (transitivo do eslint) |
| typescript-eslint | 8.59.2 | >= 8.72.3 | Media | Advisories nos sub-pacotes `@typescript-eslint/*` (6.16.0–8.72.2). O `npm audit fix` sugere 8.36.0 — validar o range exato na prática |
| typescript | 6.0.3 (range ~6.0.2) | manter 6.0.x (latest 7.0.2) | Sem advisory | **Nao subir para 7.x sem migração planejada**: `typescript-eslint` suporta `<6.1.0`; TS 7 (native) é breaking |
| tailwindcss | 4.3.0 | 4.3.5 | Sem advisory | Manutenção |
| @tailwindcss/vite | 4.3.0 | 4.3.5 | Sem advisory | Paridade com tailwindcss |
| jsdom | 29.1.1 | 31.0.0 | Sem advisory | Manutenção (teste) |
| @types/node | 24.12.3 | 26.6.6 | Baixa | Alinhar com a versão real de Node usada (hoje 20/22) |
| @vitejs/plugin-react | 6.0.1 | 6.3.0 | Sem advisory | Manutenção |
| eslint-plugin-react-hooks | 7.1.1 | 7.1.1 | — | Em dia |
| autoprefixer / @testing-library/* | atuais | atuais | — | Sem advisory reportado |

### B.3 Vulnerabilidades de dependências indiretas (resolvidas atualizando os pacotes raiz)

| Pacote indireto | Severidade | Resolvido por |
|---|---|---|
| undici (7.0.0–7.30.0) | **Alta** (8 advisories: DoS unbounded memory em EventSource, bypass de SRI, DoS content-encoding, cache poisoning via redirects cross-origin, bypass de validacao de certificado TLS, DoS TLS renegotiation) | atualização transitiva via vite/vitest/node |
| browserslist (<=4.28.6) | **Alta** (OOM por crescimento sem limite de cache; crash/prototype write via `browserslist-stats.json` nao confiavel) | subida de toolchain (postcss/vite) |
| zod (<4.6.6) | **Alta** (esgotamento de memória validando colecoes oversized) | transitivo (validar origem — não é dependência declarada) |
| follow-redirects (1.16.0–1.16.1) | **Alta** (3 advisories: bypass de stripping de credenciais cross-origin em redirects — via axios) | `axios >= 1.18.0` |
| form-data (4.0.0–4.0.5) | **Alta** (injeção CRLF em nomes de campo/filename) | transitivo (axios) |
| source-map-js (1.0.0–1.2.1) | **Alta** (DoS de event loop via offsets de secao) | `postcss >= 8.5.23` / toolchain |
| brace-expansion (3.0.0–5.0.11) | **Alta** (6 advisories de DoS) | transitivo (eslint/minimatch) |
| nanoid (<=3.3.17) | **Alta** (loop infinito com tamanho negativo/zero) | transitivo (postcss) |
| minimatch / @eslint/config-array / baseline-browser-mapping / @babel/core / @vitest/mocker | Media/Baixa | eslint >= 10.0.2, vitest >= 4.1.12, toolchain |

### B.4 Configurações de build, segurança e comunicação

- **Build:** `vite.config.ts` injeta `__APP_COMMIT__`/`__APP_ENV__` via `define`; testes com
  Vitest + jsdom. `npm run build` = `tsc -b && vite build`. OK.
- **Autenticação no cliente:** `src/services/authService.ts` e `api.ts` — JWT
  (access/refresh) armazenado em **`localStorage`** e enviado via header `Authorization: Bearer`.
  **Risco:** qualquer XSS expõe os tokens (mitigável apenas com cookies `HttpOnly` +
  same-site, o que exigiria mudança de arquitetura no backend/CSRF).
- **Comunicação com backend:** `axios` com `baseURL = import.meta.env.VITE_API_URL`
  (injetada no build via `VITE_API_URL`). Em produção (Vercel) a origem difere da API
  (Render) — depende do CORS configurado.
- **`vercel.json`:** rewrite SPA `/(.*) -> /index.html`. Sem headers de segurança
  (CSP, X-Frame-Options etc.) — recomendação preventiva.
- Não há `dangerouslySetInnerHTML` no código-fonte — risco de XSS por renderização React é
  baixo; o vetor principal é o token em localStorage.

---

## C. Backend

**Runtime:** Python 3.11 (Dockerfile dev/prod e CI `setup-python`).
**Atenção:** o venv local em `backend/env` foi criado com **Python 3.10.12**
(`pyvenv.cfg`) — desalinhado com o runtime oficial (3.11).
**Gerenciador de pacotes:** `pip` + `requirements.txt` (versões pinadas, sem lock de hashes).
**Banco:** PostgreSQL (psycopg2-binary), via `dj-database-url`.

### C.1 Tabela de dependências

| Dependência | Versão atual | Versão recomendada | Severidade | Motivo da atualização |
|---|---|---|---|---|
| Django | 5.2.14 | **5.2.19** (latest 5.2.x) | **Crítica/Alta** | 10 advisories (ver seção E): `get_signed_cookie` com sal nao injetiva (PYSEC-2026-199); cache nao invalida por `Authorization` (PYSEC-2026-197); reuso de senha SMTP (PYSEC-2026-200); `has_vary_header` sem strip (PYSEC-2026-198); mismatch `Cache-Control` (PYSEC-2026-201); cache de respostas variando por header (PYSEC-2026-2090); `DomainNameValidator` aceita newline (PYSEC-2026-2092); GeoDjango `GDALRaster` over-read (PYSEC-2026-2091); DoS `GEOSGeometry` (PYSEC-2026-3717); spatial lookups raster (PYSEC-2026-4035) |
| djangorestframework | 3.17.1 | **3.18.3** (latest) | **Alta** | 5 advisories: bypass de `DATA_UPLOAD_MAX_MEMORY_SIZE` (CVE-2026-114136); `AdminRenderer` revela dados em 400 de escrita (PYSEC-2026-3828); content negotiation sem limite de tokens (DoS, CVE-2026-114138); `TokenProxy.delete()` nao deleta (CVE-2026-114137); parsing de `request.data` (PYSEC-2026-3827) |
| PyJWT | 2.12.1 | **2.15.1** (latest) | **Crítica** | 16 advisories na biblioteca de autenticação: politica de algoritmos HMAC/assimetricos (PYSEC-2026-176/179); SSRF em `PyJWKClient` (PYSEC-2026-175); refresh de JWKS por token (PYSEC-2026-177); detached JWS (PYSEC-2026-178); redirect nao validado no JWKS (PYSEC-2026-4144); Re-DoS `is_pem_format` (PYSEC-2026-4148); JWS malformado aceito (PYSEC-2026-4147); JWK set aborta em JWK invalido (PYSEC-2026-4152); HMAC com JWK de chave vazia (GHSA-pxh4-856f-4h89); OKP (PYSEC-2026-4183); mutacao de `options` (PYSEC-2026-4146), entre outros |
| sqlparse | 0.5.5 | **0.6.1** (latest) | Media | 5 advisories de DoS/ReDoS/injeção via output filters (PYSEC-2026-3696/3697/3698/3699/3923) — dependência de Django |
| djangorestframework_simplejwt | 5.5.1 | 5.5.1 (latest) | — | Em dia; **indiretamente afetado pelos advisories do PyJWT** (backend de tokens) |
| django-cors-headers | 4.9.0 | 4.9.0 (latest) | — | Em dia |
| drf-spectacular | 0.29.0 | 0.30.0 | Baixa | Manutenção; sem advisory reportado |
| gunicorn | >=23.0.0 (nao pinado) | pinar em **27.0.0** (latest) | Baixa | Pinar versão para reprodutibilidade; sem advisory reportado |
| psycopg2-binary | 2.9.12 | 2.9.13 | Baixa | Manutenção; sem advisory reportado |
| django-environ | 0.13.0 | 0.14.0 | Baixa | Manutenção |
| asgiref | 3.11.1 | 3.12.1 | Baixa | Manutenção (requisito de Django) |
| dj-database-url | (nao pinado) | pinar em 3.1.2 | Baixa | Pinar para reprodutibilidade |
| setuptools | (nao pinado) | pinar | Baixa | Pinar para reprodutibilidade |
| typing_extensions | 4.15.0 | 4.16.0 | Baixa | Manutenção |
| jsonschema / PyYAML / attrs / inflection / python-decouple / rpds-py / jsonschema-specifications / referencing / uritemplate | atuais | atuais | — | Sem advisory reportado |

### C.2 Componentes e configuração de produção

- **Autenticação/autorização:** DRF com `JWTAuthentication` (SimpleJWT), permissão padrão
  `IsAuthenticated`, user model custom (`accounts.User`), perfis ADMIN/SELLER.
  `SIMPLE_JWT`: access 15 min, refresh 2 h — valores razoaveis.
- **Banco:** PostgreSQL via `dj_database_url` (conn_max_age=600) — OK. Sem `RawSQL` ou
  queries crues identificadas nos apps (uso do ORM) — risco de SQL injection baixo.
- **Configuração de produção — FALTANDO em `core/settings.py`:**
  `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`/`INCLUDE_SUBDOMAINS`/`PRELOAD`,
  `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`.
  Presentes apenas: `SECURE_BROWSER_XSS_FILTER`, `SECURE_CONTENT_TYPE_NOSNIFF`.
  Como o app é stateless (JWT via header), o impacto pratico dos cookies secure é menor,
  mas o admin Django usa sessões/CSRF — os gaps continuam relevantes.
- **`entrypoint.sh`:** aplica migrations, `collectstatic`, cria superuser via
  `DJANGO_SUPERUSER_*` e faz `seed_demo` em todo boot. **Recomendação preventiva:** o
  seed de dados demo rodando em produção é um risco (dados ficticios em banco prod).

---

## D. Infraestrutura

| Item | Atual | Observação / Recomendado |
|---|---|---|
| Backend image base | `python:3.11` (dev e prod) | **Nao pinado em patch**. Sem tag fixa o build nao é reprodutivel. Recomendação: pinar (ex. `python:3.11-slim` com patch) e considerar variante `-slim` |
| Frontend build image | `node:20-alpine` | **Incompatível com `vitest@4.1.11`** (exige >= 22.12) e no limite do `vite@8` (`^20.19.0 \|\| >=22.12.0`). **Recomendado: `node:22-alpine` (LTS)** |
| Frontend serve image | `nginx:alpine` | Nao pinado em versão; sem headers de segurança no `nginx.conf` (CSP, X-Content-Type-Options, HSTS, X-Frame-Options) |
| PostgreSQL (dev/CI) | `postgres:16-alpine` | Em dia (PG16). A versão em produção (Render) **nao pôde ser verificada** a partir do repositório |
| CI frontend | Node **20** (`actions/setup-node`) | Desalinhado com o exigido por vite/vitest; **recomendado: 22** |
| CI backend | Python **3.11** | Alinhado com Dockerfile |
| gunicorn (prod) | `--workers 4 --threads 2` | OK; sem advisory |
| Local vs producao | venv Python **3.10.12** local vs **3.11** em Docker/CI; Node 20 (Docker/CI) vs 22 (host) | Desalinhamentos a normalizar (ver F, item 1) |
| Render / Vercel | Frontend -> Vercel (rewrite SPA); Backend -> Render (gunicorn) | **Nao verificável a partir do repositório** (sem `render.yaml`/config de Vercel no repo, exceto `vercel.json`). Configurações de produção nessas plataformas precisam de conferencia manual |

---

## E. Vulnerabilidades

Classificação de severidade usada neste relatório:
- **CRÍTICA** = vulnerabilidade na camada de autenticação com exploração remota.
- **ALTA** = exploração remota com impacto (DoS, bypass, leitura de dados).
- **MÉDIA** = impacto limitado ou com pré-condição.
- **BAIXA** = higiene/manutenção.
- **Recomendação preventiva** = boa pratica sem vulnerabilidade ativa confirmada.

### E.1 Vulnerabilidades efetivamente identificadas

| # | Componente | Identificador | Severidade | Descrição | Impacto potencial | Correção |
|---|---|---|---|---|---|---|
| 1 | PyJWT | PYSEC-2026-175/176/177/178/179 | **CRÍTICA** | Falhas de verificacao de token: politica de algoritmos, SSRF em `PyJWKClient` (uri direto no `urlopen`), refresh de JWKS por token, detached JWS, mix de algoritmos HMAC/assimetrico | Bypass de autenticação, falsificação de token, DoS | `PyJWT >= 2.13.0` (ideal 2.15.1) |
| 2 | PyJWT | PYSEC-2026-4140/4141/4144/4145/4146/4147/4148/4149/4152/4183; GHSA-pxh4-856f-4h89 | **CRÍTICA/ALTA** | Redirect nao validado em JWKS; Re-DoS `is_pem_format`; JWS malformado aceito; JWK set aborta em JWK invalido; HMAC com JWK de chave vazia; mutacao de `options`; OKP; DoS por `kid` | DoS, bypass de verificacao, chave nula aceita | `PyJWT >= 2.15.0` (recomendado 2.15.1) |
| 3 | Django | PYSEC-2026-197/198/199/200/201/2090/2091/2092/3717/4035 | **ALTA** | Cache nao invalida por `Authorization`/`Cache-Control` (cache poisoning entre usuarios); `get_signed_cookie` com sal nao injetiva; reuso de senha SMTP; `DomainNameValidator` aceita newline; GeoDjango over-read/DoS | **Exposicao de dados de um usuario a outro via cache**, forjamento de cookie assinado, DoS | `Django >= 5.2.17` (ideal 5.2.19) |
| 4 | djangorestframework | CVE-2026-114136/114137/114138; PYSEC-2026-3827/3828 | **ALTA** | Bypass de `DATA_UPLOAD_MAX_MEMORY_SIZE` (alocacao de memoria arbitraria, nao autenticado); `AdminRenderer` revela dados em erro 400; content negotiation DoS; `TokenProxy.delete()` ineficaz | DoS de worker, **vazamento de dados protegidos por permissao de GET**, token nao revogado | `djangorestframework >= 3.18.2` (ideal 3.18.3) |
| 5 | axios (frontend) | GHSA-xj6q-8x83-jv6g, GHSA-mmx7-hfxf-jppx, GHSA-pmv8-rq9r-6j72, GHSA-mwf2-3pr3-8698, GHSA-gcfj-64vw-6mp9 | **ALTA** | Prototype pollution (injeção de Basic auth, alteracao de request); DoS `formToJSON`; bypass `maxBodyLength` (HTTP/2); proxy herdado em Node | Roubo/alteracao de credenciais em request, DoS | `axios >= 1.18.0` (ideal 1.21.1) |
| 6 | react-router (frontend) | CVE-2025-68470 (bypass); GHSA-h8fp-f39c-q6mh, GHSA-337j-9hxr-rhxg, GHSA-chx6-hx7r-mcp5, GHSA-qwww-vcr4-c8h2 | **ALTA** | Open redirect em `<Link>`/`useNavigate`; XSS via RSCErrorHandler; injeção de construtor em `deserializeErrors` (SSR); DoS por matching de rotas; bypass CSRF em RSC | Redirecionamento malicioso, XSS, acao nao autorizada, DoS | `react-router-dom >= 7.18.2` |
| 7 | vite (frontend) | GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm, GHSA-v6wh-96g9-6wx3, GHSA-698v-4r3x-3vcv, GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-fx2h-pf6j-xcff | **ALTA** | Execucao arbitraria de comando via flags de editor; bypass `fs.existsSync`; disclosure NTLMv2; cross-origin script execution; bypass `server.fs.allow/deny` | Comprometimento de maquina de dev, execucao de codigo (ambiente build/dev) | `vite >= 8.1.6` (ideal 8.3.8) |
| 8 | postcss (frontend) | GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp | **ALTA** | Path traversal em auto-carga de `sourceMappingURL` (leitura arbitraria de `.map`) | Leitura de arquivos fora do projeto (ambiente build) | `postcss >= 8.5.23` |
| 9 | undici (indireto) | GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm | **ALTA** | DoS unbounded memory (EventSource); bypass SRI; DoS content-encoding; cache poisoning cross-user via redirects; bypass de validacao de certificado TLS; DoS TLS renegotiation | Bypass TLS, exposicao de dados entre usuarios, DoS | Atualizacao transitiva (node/vite/vitest) |
| 10 | browserslist (indireto) | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g | **ALTA** | OOM por cache sem evicção; crash/prototype write via `browserslist-stats.json` malicioso | DoS, possivel execucao de codigo em build | Subida de toolchain |
| 11 | follow-redirects / form-data (indiretos, via axios) | GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p; GHSA-hmw2-7cc7-3qxx | **ALTA** | Bypass de stripping de credenciais em redirect cross-origin; injeção CRLF em multipart | Vazamento de credenciais, header injection | `axios >= 1.18.0` |
| 12 | source-map-js / nanoid / zod / brace-expansion (indiretos) | GHSA-68fv-2mgg-jv7q; GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8; GHSA-mrhx-c7xc-m3w5; GHSA-3jxr-9vmj-r5cp et al. | **ALTA** | DoS de event loop; loop infinito; esgotamento de memoria; DoS por expansao | DoS | Atualizacao transitiva |
| 13 | sqlparse | PYSEC-2026-3696/3697/3698/3699/3923 | **MÉDIA** | DoS/ReDoS em parsing; injeção via output filters Python/PHP; limites de grouping ineficazes | DoS do parser de SQL (debug/migrations) | `sqlparse >= 0.6.0` |
| 14 | eslint / @eslint/js / typescript-eslint (dev) | (advisories nos sub-pacotes) | **MÉDIA** | Vulnerabilidades em `@eslint/config-array`, `minimatch`, `@typescript-eslint/*` | Risco em ambiente de build/dev (toolchain) | eslint >= 10.0.2; typescript-eslint >= 8.72.3 |

### E.2 Configurações inseguras / recomendações preventivas (sem CVE ativo)

| # | Item | Severidade | Descrição | Recomendação |
|---|---|---|---|---|
| P1 | JWT em `localStorage` (frontend) | **ALTA** | Tokens access/refresh em `localStorage` sao legiveis por qualquer XSS | Avaliar migrar para cookies `HttpOnly` + `SameSite=Lax` (exige ajuste de CSRF no backend) |
| P2 | Ausência de `SECURE_SSL_REDIRECT` / `SECURE_HSTS_*` no Django | **MÉDIA** | Sem redirect forcado para HTTPS nem HSTS | Definir em `settings.py` para producao (condicionado a `DEBUG=False`) |
| P3 | Ausência de `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | **MÉDIA** | Cookies de sessao/CSRF (admin) podem trafegar em HTTP | `True` em producao |
| P4 | Ausência de `CSRF_TRUSTED_ORIGINS` | **MÉDIA** | Origem do frontend (Vercel) nao esta confiada p/ CSRF (relevante p/ admin e endpoints com CSRF) | Popular a partir de env |
| P5 | `SECURE_BROWSER_XSS_FILTER = True` | **BAIXA** | Setting descontinuado e ineficaz nos navegadores modernos | Remover; usar CSP |
| P6 | `nginx.conf` sem headers de segurança | **MÉDIA** | Sem CSP, X-Content-Type-Options, X-Frame-Options, HSTS no proxy | Adicionar headers no nginx (ponto unico) |
| P7 | `seed_demo` no boot do entrypoint | **MÉDIA** | Cria dados demo em qualquer ambiente, inclusive prod | Condicionar a ambiente dev |
| P8 | `vercel.json` sem security headers | **BAIXA** | Sem CSP/frameguard no deploy Vercel | Adicionar `headers` no vercel.json |
| P9 | `ALLOWED_HOSTS` com `backend` incluso no exemplo prod | **BAIXA** | Host interno exposto; validar o conjunto real em producao | Revisar valores reais (sem expor .env) |
| P10 | CORS | **BAIXA** | `CORS_ALLOWED_ORIGINS` via env — configuracao correta depende do valor real (nao verificavel aqui) | Confirmar que nao ha `*` em producao |

**SQL Injection:** nao identificada — o backend usa ORM do Django/DRF; sem `RawSQL`/`raw()`
nos apps. **CSRF:** o app API é JWT stateless (CSRF nao se aplica a endpoints Bearer);
o admin Django usa o middleware CSRF padrao (mitigado por P3/P4). **XSS:** sem
`dangerouslySetInnerHTML`; vetor principal e o token em localStorage (P1).

---

## F. Plano de atualização

Sequência considerada considerando dependencias entre bibliotecas e incompatibilidades.
**Nenhuma dessas acoes foi executada** — apenas proposta.

### Etapa 0 — Normalização de runtimes (pré-requisito)
- **CRÍTICA**
  1.1 Subir a imagem de build do frontend para `node:22-alpine` e a CI para Node 22
     (resolvi a incompatibilidade com `vitest@4.1.11` e o limite do `vite@8`).
  1.2 Recrear o venv local do backend em Python 3.11 (hoje 3.10.12) para alinhar com
     Docker/CI.
  1.3 Pinar imagens-base (`python:3.11-slim.<patch>`, `node:22-alpine.<patch>`,
     `nginx:alpine.<patch>`, `postgres:16-alpine.<patch>`).

### Etapa 1 — Backend: correções de segurança (independente do frontend)
- **CRÍTICA**
  2.1 `PyJWT 2.12.1 -> 2.15.1` (16 advisories; camada de autenticação).
      Compatibilidade: SimpleJWT 5.5.1 e DRF nao impem teto de PyJWT < 2.15 — validar
      com a suíte de testes de autenticação.
- **ALTA**
  2.2 `Django 5.2.14 -> 5.2.19` (mesma linha 5.2 — backward compatible; resolve 10
      advisories, inclusive cache poisoning).
  2.3 `djangorestframework 3.17.1 -> 3.18.3` (3.18.x e minor; validar serializers/
      viewsets contra breaking changes da 3.18).
  2.4 `sqlparse 0.5.5 -> 0.6.1` (dependencia de Django; confirmar compatibilidade com
      Django 5.2.19).
- **MÉDIA**
  2.5 `psycopg2-binary 2.9.12 -> 2.9.13`; `django-environ 0.13.0 -> 0.14.0`;
      `asgiref 3.11.1 -> 3.12.1`; `typing_extensions 4.15.0 -> 4.16.0`;
      `drf-spectacular 0.29.0 -> 0.30.0`.
- **BAIXA**
  2.6 Pinar `gunicorn` (27.0.0), `dj-database-url` (3.1.2) e `setuptools`.

### Etapa 2 — Backend: hardening de produção (após etapa 1)
- **ALTA**
  3.1 Adicionar em `core/settings.py` (condicionados a producao):
      `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`/`INCLUDE_SUBDOMAINS`/`PRELOAD`,
      `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`.
  3.2 Avaliar migrar JWT de `localStorage` para cookies `HttpOnly` (P1) — mudança de
      arquitetura, requer planejamento separada.
- **MÉDIA**
  3.3 Condicionar `seed_demo` ao ambiente dev (P7).
- **BAIXA**
  3.4 Remover `SECURE_BROWSER_XSS_FILTER` (P5); revisar `ALLOWED_HOSTS` (P9).

### Etapa 3 — Frontend: correções de segurança
- **ALTA**
  4.1 `axios 1.16.1 -> 1.21.1` (resolve follow-redirects/form-data transitivos).
  4.2 `react-router-dom 7.15.1 -> 7.18.5` (resolve react-router).
  4.3 `vite 8.0.12 -> 8.3.8` (pin exato; resolver os 7 advisories; depende da Etapa 0
      para o Node 22).
  4.4 `postcss 8.5.14 -> 8.5.x >= 8.5.23` (resolver source-map-js/nanoid transitivos).
  4.5 `vitest 4.1.11 -> 5.1.0` (ou >= 4.1.12) — **depois** do Node 22 (Etapa 0).
- **MÉDIA**
  4.6 `eslint 10.4.0 -> 10.14.0` + `@eslint/js` + `typescript-eslint 8.59.2 -> >= 8.72.3`
      (resolver brace-expansion/minimatch transitivos).
- **BAIXA**
  4.7 `react`/`react-dom 19.2.6 -> 19.3.1`; `dayjs 1.11.20 -> 1.11.23`;
      `tailwindcss`/`@tailwindcss/vite 4.3.0 -> 4.3.5`; `jsdom 29.1.1 -> 31.0.0`;
      `@vitejs/plugin-react 6.0.1 -> 6.3.0`; `@types/node 24.12.3 -> 26.6.6`.
  4.8 Remover `@types/react-router-dom` (obsoleto no v7).
  4.9 Reconciliar `lucide-react` (range ^1.16.0 vs 1.43.0 instalado) e atualizar p/ >= 1.72.0.
- **NÃO APLICAR agora:** `typescript 6.0.x -> 7.x` (breaking; `typescript-eslint` suporta
  apenas `<6.1.0`) — tratar em iniciativa separada.

### Etapa 4 — Infraestrutura e headers (após etapas 1–3)
- **MÉDIA**
  5.1 Adicionar headers de segurança no `nginx.conf` e/ou `vercel.json`
      (CSP, X-Content-Type-Options, X-Frame-Options, HSTS) — P6/P8.
  5.2 Conferir (manualmente, fora do repositório) as configurações de produção no
      Render e Vercel: HTTPS, CORS, ALLOWED_HOSTS, versão do PostgreSQL.
- **BAIXA**
  5.3 Atualizar `postgres:16-alpine` para o patch mais recente quando disponível.

### Ordem de execução resumida

| Ordem | Prioridade | Ação |
|---|---|---|
| 1 | CRÍTICA | Etapa 0 (runtimes Node 22 / Python 3.11 / pin de imagens) |
| 2 | CRÍTICA | Etapa 1.2.1 (PyJWT 2.15.1) |
| 3 | ALTA | Etapa 1 (Django 5.2.19, DRF 3.18.3, sqlparse 0.6.1) |
| 4 | ALTA | Etapa 2.3.1 (hardening de settings de producao) |
| 5 | ALTA | Etapa 3 (axios, react-router, vite, postcss, vitest) |
| 6 | MÉDIA | Etapa 1.2.5 / 3.4.6 (manutenção backend + toolchain frontend) |
| 7 | MÉDIA | Etapa 4 (headers nginx/vercel; conferencia Render/Vercel) |
| 8 | BAIXA | Etapas 2.3.4 / 3.4.8-4.9 / 4.5.3 (higiene) |

**Dependencias críticas entre acoes:**
- `vitest` >= 5.1.0 e `vite` 8.x **exigem** Node 22 (Etapa 0 antes da Etapa 3).
- `sqlparse` 0.6.x deve ser compativel com o Django alvo (validar junto na Etapa 1).
- `typescript-eslint` limita `typescript` a `<6.1.0` (bloqueia TS 7).
- O hardening de cookies/CSRF (Etapa 2) deve preceder ou acompanhar a eventual migracao
  do JWT para HttpOnly cookies.

---

## G. Conclusão

**O projeto NAO está apto a permanecer como está em produção**: ha vulnerabilidades
efetivas (sem ser somente recomendacoes preventivas) nas camadas de autenticação
(PyJWT), framework (Django, DRF) e no toolchain do frontend (vite, postcss, axios,
react-router). As atualizacoes propostas sao viaveis e, em grande parte, backward
compatible dentro da mesma linha de versão (Django 5.2.x, React 19.x, React Router 7.x).

**O projeto ESTA apto a receber as atualizacoes propostas**, desde que:

1. **Ponto de atencao especial — PyJWT (CRÍTICA):** é a base da autenticação. A subida
   2.12.1 -> 2.15.1 deve ser validada com a suíte de testes de login/refresh/revogação
   antes do deploy.
2. **Ponto de atencao especial — Node 22 (CRÍTICA):** `vite@8` e `vitest@4.1.11` nao
   rodam de forma confiavel em Node 20. A mudanca de imagem/CI e pre-requisito das
   atualizacoes do frontend.
3. **DRF 3.17 -> 3.18** e **Django 5.2.14 -> 5.2.19** sao baixos risco (mesma linha),
   mas devem passar pela suíte completa de testes do backend (`python manage.py test`).
4. **typescript 7** deve ser **excluido** desta rodada (incompatibilidade com
   `typescript-eslint`).
5. **Hardening de producao** (headers HSTS/SSL/cookies, CORS, CSRF_TRUSTED_ORIGINS) deve
   acompanhar as atualizacoes, pois so por si nao mitiga os CVEs, mas fecha vetores
   complementares.
6. **Divergencias a resolver antes de atualizar:** `lucide-react` (range vs instalado),
   venv Python 3.10 local, e a versao do PostgreSQL em producao (nao verificavel no repo).

**Nao implementado nesta etapa:** nenhuma recomendacao foi aplicada. O presente documento
e exclusivamente diagnostico. Os commits devem ser realizados manualmente pelo
responsavel, apos revisao e aprovacao.

---

## Apêndice — Metodologia e limitações

- `npm audit` e `pip-audit` reportam **advisories conhecidos**; ausencias de advisory nao
  garantem ausencia de vulnerabilidade.
- Versoes "latest" foram obtidas em 2026-11-12 via `npm view` / `pip index versions` e
  podem mudar.
- A severidade dos itens de backend usa a classificacao do `pip-audit`/advisories; onde o
  advisory nao traz score CVSS, a severidade foi inferida pelo contexto (componente e
  tipo de falha) e sinalizada como tal.
- Configurações de producao do Render e Vercel, o valor real de `CORS_ALLOWED_ORIGINS` e a
  versao do PostgreSQL em producao **nao puderam ser verificados** a partir do
  repositório (estao fora dele / em arquivos `.env` que nao devem ser expostos).
