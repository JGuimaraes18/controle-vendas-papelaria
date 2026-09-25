"""Sonda de round-trip e disponibilidade do pooler PostgreSQL/Supabase.

Mede o RTT por statement numa conexao aquecida (mesmo regime do Django com
conn_max_age=600) e, opcionalmente, monitora a disponibilidade do pooler.

Uso (via container, sem instalar nada na maquina):
    docker run --rm --network host --env-file .env_prod \
        -v "$PWD/loadtest/scripts":/scripts:ro \
        --entrypoint python spassu-backend /scripts/pooler-rtt-probe.py --samples 60

Modos:
    --samples N      numero de SELECT 1 numa conexao quente (padrao 60)
    --interval S     intervalo entre amostras em modo --watch (padrao 10)
    --watch          continua medindo e emitindo CSV (timestamp,ok,ms,reconnects)
    --min-rate F     taxa minima de sucesso exigida no modo --samples (padrao 1.0)
    --cold-timeout T timeout de cada tentativa de conexao (padrao 10)

Codigo de saida: 0 em conformidade, 1 se a taxa de sucesso ficar abaixo do limite,
2 se nao for possivel conectar.
"""

import argparse
import os
import statistics
import time

import psycopg2
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--samples", type=int, default=60)
parser.add_argument("--interval", type=float, default=10.0)
parser.add_argument("--watch", action="store_true")
parser.add_argument("--min-rate", type=float, default=1.0)
parser.add_argument("--cold-timeout", type=int, default=10)
args = parser.parse_args()

url = urlsplit(os.environ["DATABASE_URL"].strip('"'))
conn_kwargs = dict(
    host=url.hostname,
    port=url.port or 5432,
    dbname=url.path.lstrip("/"),
    user=url.username,
    password=url.password,
    connect_timeout=args.cold_timeout,
    application_name="spassu-rtt-probe",
)


def percentile(values, p):
    if not values:
        return float("nan")
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round((len(ordered) - 1) * p)))]


def connect():
    return psycopg2.connect(**conn_kwargs)


def warm_connection():
    """Abre a conexao de trabalho e espera o pooler estar saudavel."""
    last = None
    for attempt in range(1, 11):
        t0 = time.perf_counter()
        try:
            conn = connect()
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("select 1")
                cur.fetchall()
            cold_ms = (time.perf_counter() - t0) * 1000
            print(
                f"[conexao] {time.strftime('%H:%M:%S')} ok na tentativa {attempt}: "
                f"connect+auth {cold_ms:.1f}ms",
                flush=True,
            )
            return conn
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(
                f"[conexao] {time.strftime('%H:%M:%S')} tentativa {attempt}/10 falhou: "
                f"{type(exc).__name__}: {str(exc)[:70]}",
                flush=True,
            )
            time.sleep(10)
    raise SystemExit(f"pooler indisponivel apos 10 tentativas: {last}")


def timed_select(conn):
    t0 = time.perf_counter()
    with conn.cursor() as cur:
        cur.execute("select 1")
        cur.fetchone()
    return (time.perf_counter() - t0) * 1000


def run_samples(conn):
    latencies = []
    failures = 0

    for index in range(1, args.samples + 1):
        try:
            latencies.append(timed_select(conn))
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(
                f"amostra {index}/{args.samples} falhou: {type(exc).__name__}: {str(exc)[:60]}",
                flush=True,
            )
            conn = warm_connection()
        if index % 10 == 0:
            print(f"  ... {index}/{args.samples}", flush=True)

    total = len(latencies) + failures
    rate = len(latencies) / total if total else 0.0
    print(f"\n== RTT por statement (conexao aquecida), n={total} ==")
    print(f"  sucesso: {len(latencies)}/{total} ({rate * 100:.1f}%)")
    if latencies:
        print(f"  p50={percentile(latencies, .50):.2f}ms")
        print(f"  p90={percentile(latencies, .90):.2f}ms")
        print(f"  p95={percentile(latencies, .95):.2f}ms")
        print(f"  p99={percentile(latencies, .99):.2f}ms")
        print(f"  min={min(latencies):.2f}ms max={max(latencies):.2f}ms")
        print(f"  media={statistics.mean(latencies):.2f}ms")

    if rate < args.min_rate:
        raise SystemExit(1)
    return 0


def run_watch():
    conn = warm_connection()
    reconnects = 0
    print("timestamp,ok,ms,reconnects", flush=True)
    while True:
        try:
            ms = timed_select(conn)
            print(
                f"{time.strftime('%Y-%m-%dT%H:%M:%S')},1,{ms:.2f},{reconnects}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            reconnects += 1
            print(
                f"{time.strftime('%Y-%m-%dT%H:%M:%S')},0,0,{reconnects} "
                f"({type(exc).__name__})",
                flush=True,
            )
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                conn = warm_connection()
            except SystemExit:
                time.sleep(10)
                continue
        time.sleep(args.interval)


if args.watch:
    run_watch()
else:
    conn = warm_connection()
    raise SystemExit(run_samples(conn))
