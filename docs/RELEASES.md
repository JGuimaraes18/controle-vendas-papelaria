# Processo de Release do CIVEN

Este documento descreve como preparar, validar, taguear e publicar uma versão do
CIVEN, além de verificar o deploy e executar rollback.

Premissas:

- a versão canônica fica em [`VERSION`](../VERSION);
- a CI valida o código, mas **não faz deploy**;
- Vercel e Render continuam responsáveis pelos deploys automáticos;
- tags publicadas nunca são movidas ou reutilizadas;
- a `main` nunca tem histórico reescrito (`reset`/force-push são proibidos).

Para entender a estratégia de versão, consulte
[`docs/VERSIONING.md`](VERSIONING.md). Para os workflows, consulte
[`docs/CI.md`](CI.md).

---

## 1. Pré-requisitos

Antes de iniciar uma Release:

- a `main` está com a CI verde;
- as mudanças estão revisadas e integradas;
- o incremento SemVer foi decidido (MAJOR, MINOR ou PATCH);
- o `CHANGELOG.md` contém os itens da versão em `## [Unreleased]`;
- não há segredos, arquivos `.env` ou artefatos locais no commit;
- o repositório local está atualizado:

```bash
git switch main
git pull --ff-only
git fetch --tags
```

---

## 2. Preparação da versão

### 2.1 Definir a versão

Consulte os critérios em [`docs/VERSIONING.md`](VERSIONING.md#5-critérios-para-incrementar-a-versão).
Exemplo: correções compatíveis após `1.0.0` resultam em `1.0.1`.

### 2.2 Atualizar `VERSION`

Edite [`VERSION`](../VERSION) com a nova versão, sem prefixo `v`:

```
1.0.1
```

### 2.3 Sincronizar os artefatos

```bash
make version-sync
```

O comando atualiza:

- `frontend/src/generated/version.ts`;
- `backend/core/version_generated.py`;
- `frontend/package.json`;
- `frontend/package-lock.json`.

Não edite os arquivos gerados manualmente.

### 2.4 Atualizar o `CHANGELOG.md`

No [`CHANGELOG.md`](../CHANGELOG.md):

1. crie a seção da nova versão, por exemplo `## [1.0.1] - AAAA-MM-DD`;
2. mova para ela os itens relevantes de `## [Unreleased]`;
3. use as categorias `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` e
   `Security` quando aplicáveis;
4. mantenha a data como `AAAA-MM-DD` até a publicação efetiva da Release;
5. atualize os links no final do arquivo:
   - `[Unreleased]` deve comparar a última versão publicada com `HEAD`;
   - a nova versão deve apontar para `.../releases/tag/vX.Y.Z`.

### 2.5 Validar a consistência

```bash
make version-check
```

Saída esperada:

```
Versão 1.0.1 consistente em todos os artefatos.
```

Em caso de erro, corrija `VERSION`, o `CHANGELOG.md` ou rode novamente o
`version-sync`; não edite os artefatos gerados à mão.

---

## 3. Validação antes do merge

Execute localmente as mesmas verificações da CI. Os comandos completos estão em
[`docs/CI.md`](CI.md#5-execução-local). Resumo:

### Backend

```bash
cd backend
python manage.py check
python manage.py test
```

### Frontend

```bash
cd frontend
npm ci
npm run lint
npx tsc -b
npm test
npm run build
```

Depois:

1. abra um Pull Request para `main`;
2. aguarde `Backend CI` e `Frontend CI` concluírem com sucesso;
3. faça o merge somente com a CI verde.

> Os workflows atuais rodam em Pull Requests para `main` e em pushes na `main`.
> Eles ainda não foram executados no GitHub Actions até a data deste documento;
> a primeira execução ocorrerá no primeiro PR/push após a autorização.

---

## 4. Criação da tag

A tag é criada **depois** do merge na `main`, no commit que contém a versão e o
CHANGELOG aprovados.

```bash
git switch main
git pull --ff-only
git tag -a v1.0.1 -m "CIVEN v1.0.1"
git push origin v1.0.1
```

Regras:

- use tag anotada (`-a`), com prefixo `v`;
- a tag deve corresponder exatamente a `v` + conteúdo de `VERSION`;
- não crie a tag antes do merge;
- não mova, apague ou reutilize uma tag já publicada.

### 4.1 Caso especial: `v1.0.0`

A data `AAAA-MM-DD` em `## [1.0.0]` deve ser substituída pela data efetiva da
publicação. A tag `v1.0.0` deve apontar para o commit final aprovado deste
trabalho de versionamento/CI/documentação, conforme decisão registrada no plano.

---

## 5. Publicação da Release

No GitHub:

1. acesse **Releases** → **Draft a new release**;
2. selecione a tag recém-criada (`vX.Y.Z`);
3. use como título `CIVEN vX.Y.Z`;
4. cole a seção correspondente do `CHANGELOG.md` como notas da Release;
5. publique a Release.

A publicação da Release é o marco que oficializa a data no CHANGELOG. Se a data
ainda estiver como `AAAA-MM-DD`, corrija-a antes de publicar.

> A CI atual não publica Releases, não cria tags e não faz deploy.

---

## 6. Verificação pós-deploy

Vercel e Render fazem deploy automático a partir do repositório. Após o deploy:

1. confirme na Vercel e no Render que o commit implantado é o commit da tag;
2. abra a aplicação e confira o rodapé da sidebar:
   - expandida: `CIVEN vX.Y.Z · <sha>`;
   - colapsada: `vX.Y.Z`;
3. consulte o endpoint público:

```bash
curl -s https://<host-do-backend>/api/version/
```

Resposta esperada (exemplo):

```json
{
  "service": "civen-backend",
  "version": "1.0.1",
  "tag": "v1.0.1",
  "commit": "abc1234",
  "commit_full": "abc1234...",
  "branch": "main",
  "environment": "production"
}
```

4. confira a versão exibida na documentação OpenAPI, quando acessível;
5. valide os fluxos principais afetados pela Release.

### 6.1 Diagnóstico de divergência de commit

Se a versão ou o commit não corresponderem ao esperado:

| Sintoma | Verificação |
|---|---|
| Rodapé mostra `dev` | Build sem `.git` e sem `VERCEL_GIT_COMMIT_SHA`/`VITE_COMMIT_SHA`/`GITHUB_SHA`. Verifique as variáveis do build local ou da plataforma. |
| Rodapé mostra commit antigo | Deploy da Vercel pode estar desatualizado; confira o commit do deployment. |
| `/api/version/` mostra commit antigo | Render pode não ter redeployado; confira o commit do serviço. |
| Versão diferente do `VERSION` | Artefatos gerados não foram sincronizados/commitados; rode `make version-sync` e valide novamente. |
| Tag diferente de `vX.Y.Z` | Corrija antes de publicar; nunca mova uma tag já publicada. |

O fallback local para `dev` é esperado quando o build não tem acesso ao `.git`
nem recebe as variáveis de CI/plataforma.

---

## 7. Rollback

### 7.1 Operacional imediato

Se a versão recém-implantada apresentar problema crítico:

1. na Vercel, promova novamente o deployment anterior estável;
2. no Render, faça rollback para o deploy anterior estável;
3. confirme o commit e a versão em `/api/version/` e no rodapé;
4. registre o incidente e abra a correção de código.

O rollback operacional não altera tags, `VERSION` ou CHANGELOG.

### 7.2 Rollback via código

Para desfazer uma mudança problemática de forma permanente:

```bash
git switch main
git pull --ff-only
git switch -c fix/revert-<descricao>
git revert <commit-problematico>
```

Depois:

1. abra um PR para `main`;
2. aguarde a CI verde;
3. faça o merge;
4. publique uma nova versão PATCH (`vX.Y.Z+1`) seguindo este documento;
5. acompanhe o deploy e valide `/api/version/` e o rodapé.

Nunca use `reset` ou force-push na `main`.

### 7.3 Regras de rollback

- não reescreva o histórico da `main`;
- não mova nem reutilize uma tag publicada;
- não reutilize o número de uma versão já publicada para outro código;
- toda correção pós-Release gera uma nova versão e uma nova entrada no
  CHANGELOG.

---

## 8. Checklist de Release

- [ ] `VERSION` atualizado com SemVer correto.
- [ ] `make version-sync` executado e artefatos gerados atualizados.
- [ ] `CHANGELOG.md` com a nova seção e itens revisados.
- [ ] `make version-check` aprovado.
- [ ] Backend: `manage.py check` e testes aprovados.
- [ ] Frontend: lint, tipos, testes e build aprovados.
- [ ] PR para `main` com `Backend CI` e `Frontend CI` verdes.
- [ ] Merge realizado.
- [ ] Tag anotada `vX.Y.Z` criada e enviada.
- [ ] Release publicada com notas do CHANGELOG.
- [ ] Data da versão preenchida no CHANGELOG.
- [ ] Deploy da Vercel e do Render verificado.
- [ ] `/api/version/` e rodapé da sidebar conferidos.
- [ ] Nenhuma tag movida ou reutilizada.
