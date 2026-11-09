# Etapa 3 — CI independente para frontend e backend

> **Status:** implementação concluída; aguardando revisão e autorização para a próxima etapa.
> **Data:** 2026-11-08
> **Plano de referência:** `docs/agents/01_engenharia_de_software_versionamento_plan.md`
> **Relatórios anteriores:** `..._etapa1.md`, `..._etapa2.md` e `..._etapa2_1.md`

Nenhum commit, push, tag ou Release foi criado. Nenhum deploy foi configurado ou
executado. Nenhum Dockerfile, Docker Compose, `vercel.json`, `.env`, dependência
ou configuração de painel da Vercel/Render foi alterado.

---

## 1. Objetivo

Criar dois workflows independentes de integração contínua no GitHub Actions,
capazes de validar o projeto em Pull Requests para `main` e em pushes na `main`,
sem realizar deploy e sem usar credenciais de produção.

Requisitos atendidos:

- lint, verificação de tipos, testes e build como verificações bloqueantes;
- nenhum `continue-on-error` e nenhuma falha ignorada;
- execução de `scripts/check_version.py`;
- gatilhos para PRs e pushes na `main`;
- permissões mínimas (`contents: read`);
- cache de dependências, `concurrency` e timeouts;
- nenhuma etapa de deploy.

---

## 2. Arquivos criados

| Arquivo | Finalidade |
|---|---|
| `.github/workflows/frontend-ci.yml` | CI do frontend. |
| `.github/workflows/backend-ci.yml` | CI do backend. |
| `docs/agents/01_engenharia_de_software_versionamento_etapa3.md` | Este relatório. |

Nenhum arquivo de código de produção foi alterado nesta etapa.

---

## 3. Estrutura comum dos workflows

Ambos os arquivos usam a mesma base:

```yaml
on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: <workflow>-${{ github.ref }}
  cancel-in-progress: true
```

- **Sem filtros `paths`**, conforme o plano, para que os checks obrigatórios de PR
  não fiquem pendentes em mudanças fora das pastas monitoradas.
- **Sem segredos de produção.** O backend usa apenas uma `SECRET_KEY` fictícia de
  CI e um PostgreSQL efêmero com credenciais descartáveis.
- **Sem `continue-on-error`.** Qualquer etapa com erro retorna status negativo.
- **Sem deploy.** Vercel e Render continuam responsáveis pelos deploys
  automáticos fora destes workflows.

### 3.1 Actions fixadas por SHA

Resolvidas a partir das tags estáveis disponíveis em 2026-11-08:

| Action | Versão | SHA |
|---|---|---|
| `actions/checkout` | `v6.1.0` | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | `v6.5.0` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/setup-python` | `v6.3.0` | `ece7cb06caefa5fff74198d8649806c4678c61a1` |

Cada referência tem um comentário com a versão correspondente para facilitar
auditoria e atualização futura.

---

## 4. Workflow de frontend

Arquivo: `.github/workflows/frontend-ci.yml`
Job: `Frontend CI / Lint, typecheck, test and build`

- Runner: `ubuntu-latest`.
- Node: `20` (mesma major do `frontend/Dockerfile.prod` e da validação local).
- Cache: `npm`, usando `frontend/package-lock.json`.
- Timeout: 15 minutos.
- `working-directory` padrão: `frontend`.

Etapas, na ordem:

1. `actions/checkout`.
2. `actions/setup-node` com Node 20 e cache npm.
3. `python3 scripts/check_version.py` (Python já presente no runner).
4. `npm ci`.
5. `npm run lint`.
6. `npx tsc -b`.
7. `npm test` (`vitest run`).
8. `npm run build` (`tsc -b && vite build`).

Variáveis de build, sem credenciais:

```yaml
VITE_API_URL: http://localhost/api
VITE_COMMIT_SHA: ${{ github.sha }}
```

`VITE_COMMIT_SHA` alimenta o `buildInfo` com o SHA real da execução, sem valor
fixo no código.

---

## 5. Workflow de backend

Arquivo: `.github/workflows/backend-ci.yml`
Job: `Backend CI / Check and test`

- Runner: `ubuntu-latest`.
- Python: `3.11` (mesma versão dos Dockerfiles).
- Cache: `pip`, usando `backend/requirements.txt`.
- Timeout: 25 minutos.
- Serviço `postgres:16-alpine`, igual ao Compose de desenvolvimento, com
  `pg_isready` como healthcheck.
- Porta `5432:5432`, banco e usuário efêmeros `civen_ci`.
- Sem `DATABASE_URL`; o workflow usa as variáveis `POSTGRES_*` já suportadas por
  `backend/core/settings.py`.

Variáveis de ambiente de teste:

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

Etapas, na ordem:

1. `actions/checkout`.
2. `actions/setup-python` com Python 3.11 e cache pip.
3. `python3 scripts/check_version.py`.
4. `pip install -r backend/requirements.txt`.
5. `python manage.py check` em `backend`.
6. `python manage.py test --verbosity=2` em `backend`.

O banco é criado e destruído pelo Django durante o suite; nenhum dado real é
utilizado.

---

## 6. Validações executadas

Como não é permitido criar commits ou pushes, os workflows **não foram executados
no GitHub Actions**. A validação foi feita por análise estática dos YAMLs e por
execução local dos mesmos comandos, em ambiente equivalente.

### 6.1 Análise estática dos workflows

```
$ docker run --rm -v /dados/Projetos/civen:/repo -w /repo rhysd/actionlint:latest -color=false
(sem saída)
exit=0
```

**Resultado:** aprovado. Sem erros de sintaxe, expressões, contextos ou uso de
actions.

### 6.2 Versionamento

```
$ python3 scripts/check_version.py
Versão 1.0.0 consistente em todos os artefatos.
```

**Resultado:** aprovado.

### 6.3 Frontend — simulação exata do workflow

Executado em `node:20-alpine`, com volume de `node_modules` limpo e as variáveis
de build do workflow:

```
$ npm ci
$ npm run lint
$ npx tsc -b
$ npm test
$ npm run build
```

Resultados:

```
Test Files  5 passed (5)
     Tests  26 passed (26)

✓ 1962 modules transformed.
✓ built in 4.00s
```

**Resultado:** aprovado. `npm ci`, lint, verificação de tipos, testes e build
passam na mesma sequência definida no workflow.

### 6.4 Backend — simulação exata do workflow

Executado em `civen-backend:latest` (Python 3.11) contra um `postgres:16-alpine`
efêmero, com exatamente as variáveis de ambiente do workflow:

```
$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py test --verbosity=1
Ran 213 tests in 374.278s

OK
```

**Resultado:** aprovado. O `check` não reporta problemas e a suíte completa passa
com o PostgreSQL e as credenciais de CI.

### 6.5 Permissões, segredos e deploy

Verificações manuais nos dois arquivos:

- `permissions: contents: read` no nível do workflow;
- nenhum `secrets.*`;
- nenhuma action de deploy/publicação;
- nenhum `continue-on-error`;
- nenhum comando de `git push`, tag ou Release;
- nenhuma referência a painéis da Vercel/Render.

**Resultado:** aprovado.

---

## 7. Limitações e divergências

1. **Workflows ainda não executados no GitHub Actions.**
   Por diretriz, não houve commit/push. A primeira execução real ocorrerá no
   primeiro PR ou push na `main`; a validação local cobriu os mesmos comandos e o
   actionlint validou a estrutura.

2. **`makemigrations --check` não foi incluído.**
   O plano previa validar essa verificação localmente antes de ativá-la. A
   validação encontrou drift **pré-existente**:

   ```
   accounts:  ~ Alter field is_staff on user
   customers: ~ Change Meta options on customer
   sellers:   ~ Change Meta options on seller
              ~ Alter field phone on seller
   ```

   Ativar o passo deixaria a CI vermelha por um problema fora do escopo. Nenhuma
   migration foi criada ou alterada. Recomenda-se tratar o drift em tarefa
   separada e, depois, adicionar o passo ao workflow.

3. **Sem testes E2E, de integração com navegador ou de carga.**
   O escopo cobre lint, tipos, testes unitários/backend e build.

4. **Sem deploy pela CI.**
   Vercel e Render continuam com seus deploys automáticos, conforme aprovado.

5. **Proteção de branch não configurada.**
   Exigir `Backend CI` e `Frontend CI` como checks obrigatórios em PRs para `main`
   é uma configuração do repositório no GitHub, fora do escopo desta etapa.

6. **Semântica UTC x horário local do dashboard permanece pendente.**
   Conforme aprovado, será tratada em atividade independente, sem alterações
   nesta etapa.

7. **Atualização das actions.**
   As actions estão fixadas por SHA. Atualizações devem ser feitas de forma
   deliberada, revisando a versão e o SHA correspondente.

---

## 8. Arquivos no working tree após a Etapa 3

Criados nesta etapa:
- `.github/workflows/frontend-ci.yml`
- `.github/workflows/backend-ci.yml`
- `docs/agents/01_engenharia_de_software_versionamento_etapa3.md`

Continuam presentes as alterações aprovadas das etapas 1, 2 e 2.1, incluindo
`VERSION`, `CHANGELOG.md`, scripts, artefatos gerados, endpoint de versão,
rodapé, correções de lint e testes de data.

---

## 9. Próxima etapa

Pelo plano original, seguem:

- **Etapa 4:** documentação operacional (`docs/VERSIONING.md`, `docs/RELEASES.md`,
  `docs/CI.md`) e ajustes de `Makefile`/`README.md`;
- **Etapa 5:** verificação final, commit, push, tag `v1.0.0` e Release — somente
  após autorização explícita.

Aguardo revisão e autorização para prosseguir.
