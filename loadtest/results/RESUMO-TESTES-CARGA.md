# Relatório de Testes de Carga e Stress (k6)

**Data:** 2026-09-24
**Alvo:** Spassu (API de controle de vendas)
**Ferramenta:** k6 v2.3.0 (imagem `grafana/k6:latest`), executado via `docker run --network host`
**Ambientes testados:** Desenvolvimento (Postgres local) e Produção (Postgres remoto via pooler Supabase transacional, porta 6543)
**Resultados brutos:** `loadtest/results/{dev,prod}-*.test.json`

---

## 1. Resumo executivo

- **Corretude de concorrência validada em ambos os ambientes**: sob corrida simultânea na baixa de estoque, o sistema **nunca vendeu além do estoque** — `50/20/0` (criadas / insuficientes / erros) exatamente em dev e prod.
- **Ambiente dev é sólido em cargas baixas-médias**: criação de venda com p95 ≈ 80 ms a 20 VUs e p95 ≈ 1,9 s a 100 VUs; zero erros 5xx em todos os cenários de escrita.
- **Produção degrada fortemente sob carga**: criação de venda salta de ~0,6 s (set up) para p95 = 60 s (timeout) com 20+ VUs, e o endpoint `GET /api/sales/` colapsa (100% timeouts). Causas raiz: **N+1 nas listagens + latência do pooler transacional remoto + threads do gunicorn saturadas**.
- **Nenhum dado real de produção foi danificado**; toda a massa gerada (seed temporário) foi removida ao final.

---

## 2. Configuração de ambiente

### 2.1 Servidor (dev vs prod)

| Item | Dev | Prod |
|---|---|---|
| Gunicorn | 4 workers × 2 threads (override `docker-compose-load.yml`) | 4 workers × 2 threads (corrigido neste trabalho) |
| DB | Postgres local (`sales_db_dev`) | Postgres remoto — pooler transacional Supabase (`db.bkqpzcbwnwnfuavyvofl...pooler.supabase.com:6543`) |
| DEBUG | True | False |
| Nginx | `nginx/nginx.conf` (proxy /api) | `frontend/nginx.conf` (proxy /api) |
| Massa | `seed_load` (determinístico) | `seed_load` temporário + `cleanup_load` ao final |

### 2.2 Correções aplicadas ao modo Prod (Fase 2)

1. Gunicorn sem workers → **4 workers × 2 threads** (`docker-compose.yml`).
2. Volumes de staticfiles alinhados: backend monta `static_volume:/app/staticfiles` (STATIC_ROOT real).
3. `VITE_API_URL` build-arg com fallback `:${VITE_API_URL:-http://localhost}` (antes resolvia vazio no shell).
4. `.env_prod`: `VITE_API_URL=http://localhost:8000/api` → `http://localhost` (as chamadas já usam `/api/...`; o valor antigo duplicava `/api` e apontava para porta não exposta).
5. `SECRET_KEY` fraca → chave forte gerada (`secrets.token_urlsafe`).
6. Adicionados `.dockerignore` em backend e frontend (excluem `env/`, `node_modules`, `dist` etc.).
7. Conexão DB de prod: passar a usar `DATABASE_URL` do pooler Supabase (opcao `pgbouncer=true` na URL foi removida porque `dj_database_url` a rejeita — o pooler já é definido pela porta 6543).

> Nota: `makemigrations --check` reporta 3 mudanças pendentes (decorativas: `Meta options` e `is_staff` default). Não foram aplicadas (não alteram comportamento). Recomenda-se gerá-las e aplicar como migração separada.

### 2.3 Instrumentação

- Pontos finais testados: `POST /api/login/`, `POST/PUT /api/sales/`, `POST /api/sales/{id}/cancel/`, `GET /api/sales/{id}/history/`, `GET /api/products/`, `GET/PATCH /api/products/{id}/`, `GET /api/customers/`, `GET /api/customers/{id}/purchase-history/`, `GET /api/sellers/`, `GET /api/commissions/`.
- Cenários: smoke, concorrência de estoque (oversell), concorrência de update, concorrência de cancelamento, load com mix realista (70/15/10/5), spike (100 VUs), soak (20 VUs por 3 min).
- Contadores customizados (`stock_created`, `stock_insufficient`, `stock_server_error`) substituem `http_req_failed` nos cenários em que 400 é comportamento esperado (estoque insuficiente).

---

## 3. Resultados

### 3.1 Smoke (2 VUs, 4 iterações)

| Cenário | checks | Discrepância |
|---|---|---|
| dev | 12/12 (100%) | latência < 70 ms |
| prod | 12/12 (100%) | criação de venda ~2,8 s (pooler remoto); GET /sellers/ 1,4 s |

### 3.2 Concorrência — oversell (estoque 50, 30 VUs, 70 iterações)

| Amb. | Criadas | Insuficientes (400) | 5xx | Estoque final | p95 create | Aprovação |
|---|---|---|---|---|---|---|
| dev | 50 | 20 | 0 | 0 | 0,62 s | OK |
| prod | 50 | 20 | 0 | 0 | 32,1 s | OK (corretude), latência alta |

**Conclusão:** a baixa de estoque é atômica e nunca ultrapassa o disponível, nos dois ambientes.

### 3.3 Concorrência — update (25 VUs, 50 iterações: criar qty 1 → atualizar qty 2)

| Amb. | Criadas | Updates OK | 5xx | p95 create | p95 update |
|---|---|---|---|---|---|
| dev | 50 | 50 | 0 | 0,74 s | 0,84 s |
| prod | 50 | 49 | 0 | 43,2 s | 51,0 s |

Prod: **1 request de update estourou o timeout do k6 (60 s)** sem erro 5xx — retornou após o limite. Latência de escrita colapsa com a disputa de row-lock no pooler remoto.

### 3.4 Concorrência — cancelamento (20 VUs, 40 iterações: criar + cancelar)

| Amb. | Criadas | Canceladas | 5xx | p95 create | p95 cancel |
|---|---|---|---|---|---|
| dev | 40 | 40 | 0 | 0,43 s | 0,45 s |
| prod | 40 | 40 | 0 | 29,1 s | 33,7 s |

### 3.5 Load — mix realista (ramp 0→50 VUs em 30 s, platô 2 min, 70% criar venda, 15% admin listas+comissões, 10% purchase-history, 5% produtos)

| Métrica | dev | prod |
|---|---|---|
| Vendas criadas | ~112 | ~112 |
| `GET /api/sales/` p50 | **45 s** (avg 47 s) | **60 s (100% timeout)** |
| `GET /api/commissions/` p50 | 18,4 s | 60 s |
| `POST /api/sales/` p50 | 9,7 s | ≥60 s |
| 5xx | 3 (504 nginx, dev) | 3 (504 nginx, prod) |
| checks | 100% (1ª), 81% (2ª, com timeout) | 43% |

Ambos os ambientes colapsam no endpoint de listagem sob 50 VUs. **A culpa principal é o N+1**: `GET /api/sales/` serializa `SaleSerializer.get_total_value` que executa `obj.items.all()` por venda, resposta chegou a 2,5 MB no dev e travou o pooler no prod.

### 3.6 Spike (ramp 0→100 VUs em 20 s, platô 30 s)

| | dev | prod |
|---|---|---|
| Requests | 6860 | falhou antes de iniciar |
| p95 create | **1,87 s** | — |
| 400 esperados (estoque) | 1387 | — |
| 5xx | 0 | — |

Dev respondeu 6.860 requisições em ~70 s (≈96 req/s) com p95 ≈ 1,9 s e 0 erros — a aplicação absorveu o pico. No prod, o **setup da massa falhou** (reset de estoque serializado tomou >60 s — `setupTimeout` precisou subir para 180 s) e a própria janela de 100 VUs não completou dentro da licença do pooler.

### 3.7 Soak (20 VUs, 3 min)

| | dev | prod |
|---|---|---|
| Vendas criadas | 3421 | 179 |
| p95 create | **0,08 s** | **60 s (timeout)** |
| 5xx | 0 | 0 |
| checks | 100% | 80% |

Dev manteve p95 < 100 ms por 3 minutos — ótima estabilidade em 20 VUs. No prod, a **latência do pooler remoto + transações com row-lock** degrada até 20 VUs, com vários requests estourando 60 s.

---

## 4. Achados e recomendações

### Achados

1. **N+1 em `GET /api/sales/` e `GET /api/commissions/`** (`SaleSerializer.get_total_value` → `obj.items.all()` por venda). Resposta de 2,5 MB no dev; inviabiliza listagem produtiva em produção. **Alta prioridade.**
2. **Latência do pooler transacional remoto**: smoke já mostra +10× (2,8 s vs 0,05 s) por operação de escrita vs Postgres local. Transações com `SELECT ... FOR UPDATE` + múltiplos statements ficam ainda mais lentas sob disputa.
3. **Gunicorn 4w/2t = 8 threads totais**: sob 50+ VUs, fila satura e requests encostam em 60 s (timeout do nginx/k6). Escalar com `--workers` proporcional a cores (ex.: `--workers 6 --threads 4`) e considerar `--worker-class gthread`/`gevent` não é recomendável para cargas com row-lock serializado — o gargalo é o **pooler + N+1**, não o WSGI.
4. **Timeout padrão de 60 s** em nginx e k6: mascarou latências reais (requests "esperando" na fila aparecem como failed). Trade-off aceitável; melhor atacar causas 1-2.
5. `VITE_API_URL=http://localhost:8000/api` no `.env_prod` estava quebrado (porta não exposta + `/api` duplicado). Corrigido para `http://localhost`.
6. `dj_database_url` rejeita `?pgbouncer=true`; a porta 6543 já identifica o pooler transacional. Mantido sem o parâmetro.

### Recomendações (priorizadas)

1. **Eliminar o N+1**: `prefetch_related("items__product")` no queryset de `GET /api/sales/` e reutilizar `SaleItem.total_value` no texto. Esperado: `GET /api/sales/` cair de >40 s para <1 s.
2. **Reavaliar o pooler**: para cargas de escrita transacionais com row-lock, avaliar conexão direta ao Supabase (porta 5432, connection pooling da lib) quando o uso for de baixa concorrência; reservar o pooler transacional para workloads de leitura.
3. **Subir gunicorn para 4–6 workers × 2–4 threads** em prod (adequado ao número de cores) e adicionar `proxy_read_timeout` explícito no nginx (ex.: 300 s), alinhado ao k6 (`http_req_timeout`).
4. **Migrações pendentes decorativas** (`Meta options`, `is_staff`): gerar `makemigrations` e aplicar em janela de baixo uso (sem impacto em dados).
5. **Repetir os testes após as otimizações** usando os mesmos scripts (idempotentes): `run.sh prod concurrency|load|spike|soak`.

---

## 5. Como reproduzir

```bash
# 1. Seed determinístico (dev ou prod)
docker compose -f docker-compose-dev.yml exec -T backend python manage.py seed_load
docker compose -f docker-compose.yml exec -T backend python manage.py seed_load

# 2. Testes
./loadtest/run.sh dev all    # ou prod/smoke/load/spike/soak/concurrency/stock
# Resultados JSON em loadtest/results/

# 3. Limpeza da massa (não destrutiva para dados reais)
docker compose -f docker-compose.yml exec -T backend python manage.py cleanup_load
```

---

## 6. Log de operações (produtos/limpezas em prod)

- Seed temporário: 1 admin, 2 sellers, 20 clientes, 10 produtos (stock 1000).
- Executados: smoke (OK), concurrency-stock (50/20/0), concurrency-update (50/49/0), concurrency-cancel (40/40/0), load, spike (setup timeouts), soak.
- Limpeza executada: **447 vendas, 447 itens, 90 changelogs, 10 produtos, 20 clientes, 2 sellers, 3 users de carga removidos**.
- Verificação pós-limpeza: dados originais intactos (11 produtos, 6 clientes, 12 vendas pré-existentes; zero resíduo `load.`).
- Estoques dos produtos de carga restaurados/removidos junto com os produtos (não há efeito residual em produtos reais).

---

## 7. Fase 3 — otimizações N+1 e reexecução (2026-09-25)

### 7.1 Alterações aplicadas

| Arquivo | Mudança |
|---|---|
| `backend/apps/sales/views.py` | `SaleViewSet.get_queryset` com `select_related("cancelled_by")` + `Prefetch("items", queryset=SaleItem.objects.select_related("product"))` |
| `backend/apps/sales/services/commission_service.py` | `calculate_commissions` com `select_related("seller__user")` e `Prefetch("items__product")` |
| `backend/apps/sales/tests/test_query_counts.py` | 11 testes de regressão de contagem de queries (`assertNumQueries`) |

Contagem de queries (mesmos asserts, antes → depois):

| Endpoint | Antes | Depois |
|---|---|---|
| `GET /api/sales/` (serializer) | 66 | 3 |
| `GET /api/sales/` (via API) | 66 | 4 |
| `GET /api/commissions/` (service) | 6 | 3 |
| `GET /api/commissions/` (via API) | 7 | 5 |

Validação automatizada: `test_query_counts` 11/11, suíte backend 142/142 (166,3 s), `npm run build` do frontend OK.

### 7.2 Dev — reexecução **não comparável** (2026-09-25 13:09–13:12 UTC)

O resultado foi grabado por completo no JSON, mas não serve como antes/depois por duas divergências de ambiente:

1. o stack foi subido com `runserver` (1 processo) em vez do override Gunicorn 4w/2t usado na baseline;
2. o banco já acumulava **10.667 vendas** das execuções anteriores (spike + soak), então as listagens sem paginação serializam o dataset inteiro.

Mesmo assim oPOST melhorou (p50 9,7 s → 1,37 s) e as 5xx caíram de 3 para 1, enquanto `GET /api/sales/` e `GET /api/commissions/` seguem em 40–60 s por causa do volume acumulado. 314 iterações, 399 requisições, 21,55% de `http_req_failed`, 64 checks falhos, p95 61,94 s.

### 7.3 Prod — antes/depois comparável (mesmo Gunicorn 4w/2t, mesma massa inicial: 12 vendas reais, 0 vendas de carga)

| Métrica | Baseline 2026-09-24 | Pós-otimização 2026-09-25 | Variação |
|---|---|---|---|
| Iterações | 152 | 453 | +198% |
| Requisições | 194 | 531 | +174% |
| `http_req_failed` | 57,73% | **0,00%** | eliminado |
| Checks | 28/66 (42,4%) | **515/515 (100%)** | — |
| `server_error` | 3 | **0** | eliminado |
| p95 duração global | 60,00 s (timeout) | 31,61 s | −47% |
| Threshold `p(95)<2000` | reprovado | reprovado | — |

Por endpoint (prod):

| Endpoint | Baseline (p50 / 201-200 / n) | Pós-otimização (p50 / 201-200 / n) |
|---|---|---|
| `POST /api/sales/` | 60,0 s / 52 de 112 | 19,4 s / **333 de 333** |
| `GET /api/sales/` | 60,0 s / **0 de 25** | 4,9 s / **62 de 62** |
| `GET /api/commissions/` | 60,0 s / 3 de 21 | 5,2 s / **62 de 62** |
| `GET /api/products/` | 1,17 s / 6 de 10 | 10,3 s / 16 de 16 (amostra pequena, sem N+1) |

**Leitura:** a remoção do N+1 eliminou os 504/timeouts e multiplicou por ~2,9 o número de requisições atendidas sem erro. O p95 de 31,6 s (acima do objetivo de 2 s) agora é dominado pelo **tamanho da resposta**: as listagens não são paginadas e devolvem a coleção inteira, e cada requisição de escrita passa pelo pooler transacional do Supabase (p50 de 19,4 s para um POST isolado é latência de pooler, não da aplicação).

### 7.4 Limpeza e integridade dos dados

| Ambiente | Removido | Verificação pós-limpeza |
|---|---|---|
| dev | 10.901 vendas, 10.901 itens, 90 changelogs, 12 produtos, 20 clientes, 2 sellers, 6 users | 7 vendas reais preservadas; 0 vendas/itens de carga; 0 itens órfãos; 0 estoque negativo; estoque real 10/0/2 inalterado |
| prod | 333 vendas, 333 itens, 0 changelogs, 10 produtos, 20 clientes, 2 sellers, 6 users | 12 vendas reais preservadas; 0 vendas/itens/clientes/produtos de carga |

### 7.5 Pendências identificadas

1. **Paginação nas listagens** (`/api/sales/`, `/api/products/`, `/api/commissions/`): maior impacto restante; sem isso o p95 fica preso ao volume total da tabela.
2. **`seed_load` não é idempotente**: `Product.objects.get(code=...)` lançou `MultipleObjectsReturned` no dev (restos de `Produto Carga 07/08` duplicados). Trocar por `get_or_create`/`update_or_create`.
3. **Instabilidade de DNS do Docker** no ambiente: derrubou frontend/nginx do dev na subida e a conexão com o pooler do Supabase exigiu 3 tentativas com backoff. Não é falha de código, mas precisa de nova execução dos cenários que falharam por DNS.
4. `npm run lint` falha em `CustomerForm.tsx:29` e `ProductForm.tsx:51` (`react-hooks/set-state-in-effect`) — erros preexistentes, fora do escopo do backend.

---

## 8. Fase 4 — atribuição de latência (2026-09-25, 18:01–19:24 UTC)

Objetivo desta fase: **medir, sem alterar a aplicação**, onde a latência se origina. Nenhuma linha de
código da aplicação foi modificada; o único código novo são os scripts de medição em
`loadtest/scripts/`.

| Script | Papel |
|---|---|
| `e1-single-vu.test.js` | E1 — tempo de serviço com 1 VU, sem fila de concorrência |
| `e3-concurrency-curve.test.js` | E3 — curva 1/4/8/16/32/50 VUs em run único contínuo |
| `e4-rtt-probe.test.js` | E4 — L2 (0 statements) e L3 (2 statements) |
| `pooler-rtt-probe.py` | E4 L1 — RTT e disponibilidade do pooler, fora da aplicação |

Condições: stack Prod, Gunicorn `4 workers × 2 threads` (não alterado), massa inicial 12 vendas
reais + 0 de carga, pooler `aws-0-us-east-1.pooler.supabase.com:6543` (PostgreSQL 17.6,
`max_connections=60`).

### 8.1 E1 — tempo de serviço, 1 VU, 12 min

277 iterações, 331 requisições, **0 falhas, 0 `server_error`**, 0,450 req/s.

| Endpoint | statements | p50 | p90 | p95 | p99 | máx |
|---|---|---|---|---|---|---|
| `POST /api/sales/` | 16 | 2,397 s | 2,607 s | 2,775 s | 3,307 s | 3,567 s |
| `GET /api/customers/…/purchase-history/` | 5 | 1,024 s | 1,149 s | 1,169 s | 1,246 s | 1,246 s |
| `GET /api/commissions/` | 5 | 0,958 s | 1,147 s | 1,236 s | 1,473 s | 1,473 s |
| `GET /api/sales/` | 4 | 0,762 s | 0,857 s | 0,903 s | 1,755 s | 1,755 s |
| `GET /api/products/` | 2 | 0,307 s | 0,354 s | 0,374 s | 0,376 s | 0,376 s |

Fases HTTP (p50) em todos os endpoints: `blocked` 0,01 ms · `connecting` 0,00 ms · `sending` 0,03 ms ·
`receiving` 0,13 ms · **`waiting` = 100% da latência**. Não há contenção de socket nem banda.

> p99 do E1 tem amostra fina: com 12 min e 1 VU a janela estável contém 195 POSTs, então o p99 de
> `POST /api/sales/` (3,307 s) representa ~2 amostras. Por isso o E3, com 327 POSTs no patamar de
> 50 VUs, é a referência de cauda.

### 8.2 E3 — curva de concorrência (run único, 6 patamares)

**0 falhas, 100% dos checks, 0 `server_error`, 0 reinícios de container.**

| VUs | req/s total | POST/s | POST p50 | POST p95 | POST p99 | threads no container | CPU p50 | CPU máx |
|---|---|---|---|---|---|---|---|---|
| 1 | 0,455 | 0,264 | 2,436 s | 3,377 s | 3,858 s | 16 | 0,7% | 8,8% |
| 4 | 1,211 | 0,731 | 2,586 s | 6,745 s | 7,137 s | 18 | 2,6% | 20,6% |
| 8 | 2,467 | 1,460 | 3,162 s | 5,627 s | 6,328 s | 18 | 8,7% | 30,6% |
| 16 | 2,741 | 1,593 | 5,013 s | 11,971 s | 13,654 s | 18 | 11,2% | 36,0% |
| 32 | 2,695 | 1,626 | 9,190 s | 22,438 s | 24,958 s | 18 | 13,6% | 33,7% |
| 50 | 2,661 | 1,722 | 13,364 s | 41,120 s | 43,039 s | 18 | 37,6% | 51,8% |

Duas leituras:

1. **O throughput satura em ~2,7 req/s a partir de 8 VUs.** Acima disso, VU adicional só acrescenta
   latência: de 16 para 50 VUs o throughput cai de 2,741 para 2,661 req/s enquanto o p50 do POST vai
   de 5,0 s para 13,4 s. Essa é a assinatura de fila em regime de saturação, não de degradação.
2. **O número de threads é constante em 18** (4 workers × 2 threads de atendimento + master + o
   `sh` do próprio `docker exec` do amostrador). A concorrência é rigidamente limitada pelo pool de
   threads do Gunicorn: 50 clientes disputam 8 slots.

O container tem `cpus: 4` (orçamento de 400%) e a CPU do Gunicorn nunca passou de **51,8%**, ou
seja, ~13% do orçamento disponível. **O Gunicorn não está saturado de CPU** — os workers ficam
ociosos esperando I/O.

### 8.3 E4 — RTT mínimo em três camadas

| Camada | Descrição | p50 | p95 | p99 | statements |
|---|---|---|---|---|---|
| L1 | `SELECT 1` direto no pooler, conexão aquecida (n=300) | **145,9 ms** | 173,1 ms | 454,6 ms | 1 |
| L2 | `GET /api/sales/` sem token → 401 | **2,0 ms** | 4 ms | 5 ms | **0** |
| L3 | `GET /api/products/` autenticado → 200 | **311,0 ms** | 389 ms | 545 ms | 2 |

O L2 foi previamente validado (P5) em banco de teste com `CaptureQueriesContext`: `GET /api/login/`,
`/api/sales/`, `/api/products/`, `/api/commissions/` e uma URL inexistente **todos retornam
exatamente 0 statements** sem token.

O L2 é o resultado mais importante da fase: **nginx + Gunicorn + Django/DRFResponse custam ~2 ms
por requisição.** Todo o resto é espera de banco.

### 8.4 Atribuição

Regressão `p50 ≈ a + b × nº de statements` sobre os cinco endpoints do E1:

- **a (custo fixo do request) = 188,9 ms**
- **b (custo marginal por statement) = 140,7 ms**
- RTT do pooler medido independentemente = **145,9 ms** → desvio de **−3,5%**

O custo marginal por statement **é** o round-trip ao pooler, confirmado por três vias independentes
(L1 direto, delta L3−L2 de 154,5 ms/statement e a inclinação da regressão).

| Endpoint | statements | p50 medido | `n × 145,9 ms` | resíduo | pooler |
|---|---|---|---|---|---|
| `POST /api/sales/` | 16 | 2.397 ms | 2.334 ms | 63 ms | **97,4%** |
| `GET /api/products/` | 2 | 307 ms | 292 ms | 15 ms | **95,0%** |
| `GET /api/sales/` | 4 | 762 ms | 584 ms | 178 ms | 76,6% |
| `GET /api/commissions/` | 5 | 958 ms | 730 ms | 228 ms | 76,1% |
| `GET /api/purchase-history/` | 5 | 1.024 ms | 730 ms | 294 ms | 71,2% |

O resíduo de 15–63 ms dos endpoints com poucos statements é a serialização Python; os listagens
(`/sales/`, `/commissions/`, `/purchase-history/`) carregam o custo adicional de serializar a
coleção inteira, que cresce com o volume.

**Os cinco componentes, com o peso de cada um:**

| # | Componente | Custo medido | Verificação |
|---|---|---|---|
| 1 | **Round-trip ao pooler** | **~146 ms por statement** | L1 n=300 (100% sucesso); delta L3−L2 = 154,5 ms; regressão = 140,7 ms |
| 2 | **Nº de statements** | multiplicador de 2 a 16 | inventário: POST 16, comissões 5, histórico 5, GET vendas 4, produtos 2, login 3 |
| 3 | **Fila do Gunicorn** | teto de **2,74 req/s**; +10,9 s de p50 entre 1 e 50 VUs | E3: throughput plano de 8 VUs em diante; threads fixas em 8 slots; CPU máx 51,8% de 400% |
| 4 | **Execução no PostgreSQL** | **0,05–4,4 ms por statement** | `EXPLAIN` remoto: 0,057 ms (GET vendas), 0,058 ms (filtro), 4,416 ms (`SELECT FOR UPDATE`) |
| 5 | **Django/DRF + nginx** | **~2 ms por requisição** | E4 L2 com 0 statements; serialização 56–115 µs/venda |

### 8.5 Por que o teto de throughput é 2,74 req/s

`8 slots ÷ 2,74 req/s = 2,92 s` de ocupação média por slot, contra ~2,0 s de tempo de serviço do mix
medido em 1 VU. Ou seja, cada thread do Gunicorn fica cerca de **69% do tempo bloqueada em I/O**.
Não é falta de worker nem CPU ociosa por engano de configuração: é falta de *slots livres*, e cada slot
fica caro porque o pooler cobra ~146 ms de cada statement.

Isso encadeia os dois achados num só fato: **o RTT do pooler é a causa tanto da latência por
requisição quanto do teto de vazão.** Um POST faz 16 statements; se cada um custasse ~5 ms em vez de
146 ms, o POST cairia de ~2,4 s para ~0,1 s e os mesmos 8 slots passariam de 2,7 para ~26 req/s.

### 8.6 Disponibilidade do pooler durante toda a sessão

**511 amostras, 511 sucesso, 0 falhas, 0 reconexões.** O RTT ficou em p50 148,5 ms / p95 314,3 ms /
p99 570,9 ms, com um pico isolado de 3,29 s e sem nenhuma falha associada.

O RTT **não degradou com a concorrência** (p50 ≈ 145 ms em todos os patamares, de 1 a 50 VUs). O pooler,
nesta carga, não é um gargalo de vazão — é um imposto fixo por statement. Nenhuma instabilidade de DNS
ocorreu nesta rodada, ao contrário do anecdote da seção 7.5.

### 8.7 Confundidor de crescimento de dados

O E3 é um run único e contínuo, conforme planejado, então o volume de vendas cresce ao longo dos
patamares. Cada POST 201 adiciona linhas, e os listagens leem a coleção inteira:

| Patamar | vendas criadas no patamar | vendas acumuladas ao fim |
|---|---|---|
| 1 VU | 41 | 53 |
| 4 VUs | 165 | 218 |
| 8 VUs | 278 | 496 |
| 16 VUs | 313 | 809 |
| 32 VUs | 232 | 1.041 |
| 50 VUs | 190 | 1.231 |

Consequência: parte do crescimento de `GET /api/sales/` e `GET /api/commissions/` entre patamares é
volume, não concorrência. O `POST /api/sales/` foi criado como endpoint de referência porque seu
custo depende do *número de statements*, não do total de vendas — a curva de throughput e de p50 do
POST acima é interpretável. Esta é a confirmação empírica de que a paginação é o que falta (§7.5.1).

### 8.8 Achado operacional: `ACCESS_TOKEN_LIFETIME` de 15 min

A primeira execução do E3 (19m56s) e a segunda (20m10s) produziram **26.533 e 7.807 respostas 401**,
respectivamente, porque o SimpleJWT emite access token com validade de 15 min
(`backend/core/settings.py`) e o `setup()` do k6 autenticava uma única vez. A partir de t=15 min todo
endpoint autenticado passou a devolver 401, o que invalidou o patamar de 50 VUs.

Correção **apenas no harness** (`loadtest/scripts/common.js`): reautenticação com TTL de 11 min,
usando a idade real do token do setup para que VUs criados em patamares tardios não nasçam com token
velho. A terceira execução terminou com 0 falhas.

Isso é comportamento esperado do SimpleJWT, não defeito: para um operador real, 15 min de access
token com refresh de 2 h é configuração normal. O que ficou registrado é que **qualquer teste de
carga com mais de 15 min precisa prever renovação de token**.

### 8.9 Limpeza e integridade

| Item | Valor |
|---|---|
| Removido | 1.394 vendas, 1.394 itens, 10 produtos de carga, 20 clientes, 2 sellers, 6 users |
| Vendas reais preservadas | **12** (idêntico ao estado inicial da rodada) |
| Itens reais preservados | 20 |
| Itens órfãos | 0 |
| `SaleChangeLog` órfãos | 0 |
| Resíduo de carga (vendas/clientes/produtos/sellers) | 0 / 0 / 0 / 0 |
| Estoque dos produtos reais | inalterado |

### 8.10 Conclusão

1. **A latência não está no código da aplicação.** nginx + Gunicorn + Django/DRF respondem uma
   requisição sem banco em **2 ms**.
2. **A latência não está na execução do PostgreSQL.** O trabalho real no banco leva 0,05–4,4 ms por
   statement, mil vezes menos que o custo de alcançá-lo.
3. **A latência é o round-trip ao pooler do Supabase: ~146 ms por statement**, e o número de
   statements multiplica esse valor. Um POST de venda são 16 statements = 2,3 s de ida e volta.
4. **O teto de vazão é consequência direta disso, não um problema de configuração do Gunicorn.**
   Com 8 slots, cada um ocupado ~2,9 s por requisição, o sistema satura em ~2,7 req/s. Aumentar
   workers resolveria o sintoma e multiplicaria o custo fixo de sustentação, sem tocar a causa.
5. **O caminho de maior impacto é reduzir o número de statements por requisição** (paginação e
   eliminação das queries de montagem de resposta), não aumentar paralelismo.

Nenhuma destas cinco conclusões foi implementada: esta fase foi estritamente de medição.