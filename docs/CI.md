# Integração Contínua (CI)

Este documento descreve os workflows de CI do CIVEN, seus gatilhos, verificações,
requisitos, execução local e configuração de proteção de branch no GitHub.

Os workflows apenas **validam** o projeto. Eles não fazem deploy, não criam tags
e não publicam Releases. Vercel e Render continuam responsáveis pelos deploys
automáticos.

> **Estado atual:** os workflows foram validados localmente em 2026-11-08 com
> `actionlint` e com a execução dos mesmos comandos em ambiente equivalente.
> Eles **ainda não foram executados no GitHub Actions**, pois nenhum commit ou
> push foi feito até esta etapa.

---

## 1. Visão geral

Existem dois workflows independentes:

| Workflow | Arquivo | Job |
|---|---|---|
| `Frontend CI` | `.github/workflows/frontend-ci.yml` | `Lint, typecheck, test and build` |
| `Backend CI` | `.github/workflows/backend-ci.yml` | `Check and test` |

Ambos:

- rodam em `pull_request` com base `main`;
- rodam em `push` para `main`;
- usam `permissions: contents: read`;
- usam `concurrency` para cancelar execuções antigas do mesmo ref;
- usam cache de dependências;
- têm `timeout-minutes` para evitar execuções travadas;
- não usam `continue-on-error`; qualquer falha reprova o workflow;
- não usam filtros `paths`, para que os checks obrigatórios de PR não fiquem
  pendentes em mudanças fora de pastas específicas.

### 1.1 Actions fixadas por SHA

| Action | Versão | SHA |
|---|---|---|
| `actions/checkout` | `v6.1.0` | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | `v6.5.0` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/setup-python` | `v6.3.0` | `ece7cb06caefa5fff74198d8649806c4678c61a1` |

As referências usam SHA completo e têm comentário com a versão. Atualizações
devem ser deliberadas, revisando a versão e o SHA correspondente.

---

## 2. Workflow de frontend

Arquivo: `.github/workflows/frontend-ci.yml`

- **Runner:** `ubuntu-latest`
- **Node:** 20
- **Cache:** npm, usando `frontend/package-lock.json`
- **Timeout:** 15 minutos
- **Diretório padrão:** `frontend`

### 2.1 Etapas

1. `actions/checkout`
2. `actions/setup-node` (Node 20 + cache npm)
3. `python3 scripts/check_version.py`
4. `npm ci`
5. `npm run lint`
6. `npx tsc -b`
7. `npm test` (`vitest run`)
8. `npm run build` (`tsc -b && vite build`)

### 2.2 Variáveis de build

```yaml
VITE_API_URL: http://localhost/api
VITE_COMMIT_SHA: ${{ github.sha }}
```

`VITE_API_URL` alimenta `frontend/src/services/api.ts` em tempo de build.
`VITE_COMMIT_SHA` alimenta o `buildInfo` para exibir o commit real da execução.

Todas as verificações são bloqueantes: lint, tipos, testes e build reprovam o
workflow em caso de erro.

---

## 3. Workflow de backend

Arquivo: `.github/workflows/backend-ci.yml`

- **Runner:** `ubuntu-latest`
- **Python:** 3.11
- **Cache:** pip, usando `backend/requirements.txt`
- **Timeout:** 25 minutos
- **Banco:** serviço `postgres:16-alpine`, efêmero, com healthcheck `pg_isready`
- **Diretório dos comandos Django:** `backend`

### 3.1 Variáveis de ambiente

```yaml
SECRET_KEY: ci-only-secret-key-not-for-production
DEBUG: "False"
ALLOWED_HOSTS: localhost,127.0.0.1
CORS_ALLOWED_ORIGINS: http://localhost
POSTGRES_DB: civen_ci
POSTGRES_USER: civen_ci
POSTGRES_PASSWORD: civen_ci_password
POSTGRES_HOST: 127.0.0.1
POSTGRES_PORT: "5432"
```

Observações:

- a `SECRET_KEY` é fictícia e existe apenas no workflow;
- nenhum segredo de produção é usado;
- `DATABASE_URL` não é definida; o projeto usa as variáveis `POSTGRES_*`;
- o banco é criado pelo serviço e o Django cria/destrói o banco de testes;
- nenhum dado real é utilizado.

### 3.2 Etapas

1. `actions/checkout`
2. `actions/setup-python` (Python 3.11 + cache pip)
3. `python3 scripts/check_version.py`
4. `pip install -r backend/requirements.txt`
5. `python manage.py check`
6. `python manage.py test --verbosity=2`

### 3.3 `makemigrations --check` temporariamente fora da CI

O plano previa validar `python manage.py makemigrations --check --dry-run`
localmente antes de ativá-lo. A validação encontrou drift **pré-existente**:

```
accounts:  ~ Alter field is_staff on user
customers: ~ Change Meta options on customer
sellers:   ~ Change Meta options on seller
           ~ Alter field phone on seller
```

Por isso, o passo **não** foi incluído nos workflows. Nenhuma migration foi
criada ou alterada nesta iniciativa. Quando o drift for tratado em tarefa
separada, o passo pode ser adicionado ao workflow de backend.

---

## 4. O que a CI não faz

- não faz deploy na Vercel ou no Render;
- não cria tags;
- não publica Releases;
- não usa banco de produção ou dados reais;
- não executa testes E2E, de navegador ou de carga;
- não configura branch protection (isso é feito no GitHub);
- não executa `makemigrations --check` no momento, pelo motivo da seção 3.3;
- não valida a existência remota da tag nem a publicação de Releases.

---

## 5. Execução local

A CI usa Node 20, Python 3.11 e PostgreSQL 16. Reproduza essas versões para evitar
diferenças.

### 5.1 Requisitos

- Node.js 20.19+ (o Vite 8 não é compatível com Node 18);
- Python 3.11+;
- PostgreSQL 16 (ou Docker);
- Make (opcional, para os alvos de versão).

### 5.2 Frontend

```bash
cd frontend
npm ci
npm run lint
npx tsc -b
npm test
npm run build
```

Se o Node local não for compatível, use Docker a partir da raiz do repositório:

```bash
docker run --rm \
  -v "$PWD/frontend:/app" \
  -v civen_frontend_node_modules:/app/node_modules \
  -w /app \
  -e VITE_API_URL=http://localhost/api \
  -e VITE_COMMIT_SHA="$(git rev-parse HEAD)" \
  node:20-alpine \
  sh -c "npm ci && npm run lint && npx tsc -b && npm test && npm run build"
```

### 5.3 Backend

Com o ambiente de desenvolvimento já criado:

```bash
make start-dev
docker compose -f docker-compose-dev.yml exec backend python manage.py check
docker compose -f docker-compose-dev.yml exec backend python manage.py test --verbosity=2
```

Alternativa nativa:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# configure SECRET_KEY e POSTGRES_* no ambiente
python manage.py check
python manage.py test --verbosity=2
```

Os testes criam um banco de testes temporário e o destroem ao final. O usuário
do PostgreSQL precisa ter permissão para criar bancos.

### 5.4 Simulação fiel do backend da CI

Para reproduzir o serviço PostgreSQL e as variáveis do workflow sem usar o banco
de desenvolvimento:

```bash
docker network create civen-ci-net

docker run -d --name civen-ci-db --network civen-ci-net \
  -e POSTGRES_DB=civen_ci \
  -e POSTGRES_USER=civen_ci \
  -e POSTGRES_PASSWORD=civen_ci_password \
  postgres:16-alpine

# aguarde o healthcheck
until docker exec civen-ci-db pg_isready -U civen_ci -d civen_ci; do sleep 1; done

docker build -t civen-backend-ci backend

docker run --rm --network civen-ci-net \
  -v "$PWD/backend:/app" \
  -w /app \
  -e SECRET_KEY=ci-only-secret-key-not-for-production \
  -e DEBUG=False \
  -e ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e CORS_ALLOWED_ORIGINS=http://localhost \
  -e POSTGRES_DB=civen_ci \
  -e POSTGRES_USER=civen_ci \
  -e POSTGRES_PASSWORD=civen_ci_password \
  -e POSTGRES_HOST=civen-ci-db \
  -e POSTGRES_PORT=5432 \
  civen-backend-ci \
  python manage.py test --verbosity=2

docker rm -f civen-ci-db
docker network rm civen-ci-net
```

### 5.5 Validação de versão

```bash
make version-check
# ou
python3 scripts/check_version.py
```

### 5.6 Verificação dos YAMLs

Se o `actionlint` estiver disponível:

```bash
actionlint
```

Ou via Docker:

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color=false
```

---

## 6. Proteção de branch no GitHub

A proteção de branch é configurada no repositório, não pelo código. Passos
sugeridos:

1. abra **Settings** → **Branches**;
2. em **Branch protection rules**, clique em **Add rule**;
3. em **Branch name pattern**, informe `main`;
4. habilite **Require a pull request before merging**;
5. habilite **Require status checks to pass before merging**;
6. selecione os checks dos workflows:
   - `Frontend CI / Lint, typecheck, test and build`;
   - `Backend CI / Check and test`;
7. habilite **Require branches to be up to date before merging**;
8. opcionalmente, habilite **Do not allow bypassing the above settings**;
9. salve a regra.

Observações:

- os nomes exatos dos checks podem variar ligeiramente na interface; confirme
  após a primeira execução real dos workflows;
- até a primeira execução no GitHub, os checks ainda não aparecem na lista;
- não marque `makemigrations --check` como obrigatório, pois ele não faz parte da
  CI no momento;
- os workflows não usam filtros `paths`, justamente para que os checks
  obrigatórios não fiquem pendentes em PRs que não tocam frontend ou backend.

---

## 7. Solução de problemas

| Problema | Causa provável | Ação |
|---|---|---|
| Frontend falha no `npm ci` | `package-lock.json` desatualizado ou Node incompatível | Rode `npm install` localmente, revise o lock e use Node 20.19+. |
| Frontend falha no build | Erro de TypeScript ou versão de Node | Rode `npx tsc -b` e `npm run build` localmente com Node 20. |
| Backend não conecta no PostgreSQL | Serviço ainda não saudável ou variáveis incorretas | Verifique o healthcheck e as variáveis `POSTGRES_*`. |
| Backend falha ao criar banco de testes | Usuário sem permissão de `CREATEDB` | Use um usuário com permissão ou o serviço padrão do workflow. |
| `check_version.py` falha | Artefatos dessincronizados, CHANGELOG sem a seção ou tag divergente | Rode `make version-sync`, ajuste o CHANGELOG e valide novamente. |
| CI não aparece no PR | Workflow ainda não foi enviado à `main` ou o PR não tem base `main` | Verifique os gatilhos e o branch de destino. |
| Check obrigatório fica pendente | Filtro `paths` ou workflow inexistente | Os workflows atuais não usam `paths`; confirme o nome do check. |

---

## 8. Limitações atuais

- os workflows ainda não foram executados no GitHub Actions;
- não há testes E2E, de navegador ou de carga;
- não há deploy pela CI;
- `makemigrations --check` está fora da CI por drift pré-existente;
- a semântica UTC x horário local do dashboard permanece pendente e será tratada
  em atividade independente;
- a proteção de branch precisa ser configurada manualmente no GitHub;
- as actions são atualizadas manualmente, com revisão de SHA.
