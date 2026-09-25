import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

import { BASE_URL, authedHeaders, fullSetup } from "./common.js";

// E4 - RTT minimo em camadas.
//
// L2: GET /api/sales/ SEM token -> 401 com 0 statements. Mede o custo de
//     nginx + gunicorn + Django/DRF sem tocar o banco.
// L3: GET /api/products/ autenticado -> 200 com 2 statements (usuario por
//     causa do JWT + catalogo). Mede 2 round-trips + auth + serializacao.
//
// L1 (SELECT 1 direto no pooler, fora da aplicacao) fica no script
// pooler-rtt-probe.py, porque precisa de uma conexao psycopg2.
//
// Execucao:
//   docker run --rm --network host --user "$(id -u):$(id -g)" \
//     -e BASE_URL=http://localhost:80/api \
//     -v "$PWD/loadtest/scripts":/scripts:ro \
//     -v "$PWD/loadtest/results":/results grafana/k6:latest run \
//     --summary-trend-stats="avg,p(90),p(95),p(99),max" \
//     --out json=/results/e4-rtt-probe.test.json /scripts/e4-rtt-probe.test.js

const WARMUP_ITERATIONS = 10;

let l2Iterations = 0;
let l3Iterations = 0;

export const options = {
  setupTimeout: "300s",
  scenarios: {
    l2_no_auth: {
      executor: "constant-vus",
      vus: 1,
      duration: "70s",
      exec: "probeL2",
      startTime: "0s",
      gracefulStop: "10s",
    },
    l3_two_statements: {
      executor: "constant-vus",
      vus: 1,
      duration: "70s",
      exec: "probeL3",
      startTime: "80s",
      gracefulStop: "10s",
    },
  },
  thresholds: {},
};

export function setup() {
  const data = fullSetup();
  return data;
}

export function probeL2(data) {
  l2Iterations += 1;
  const tags = { probe: "L2", stage: l2Iterations <= WARMUP_ITERATIONS ? "warmup" : "steady" };

  const res = http.get(`${BASE_URL}/sales/`, { tags });

  check(res, { "L2: 401 sem token": () => res.status === 401 });
  sleep(0.2);
}

export function probeL3(data) {
  l3Iterations += 1;
  const tags = { probe: "L3", stage: l3Iterations <= WARMUP_ITERATIONS ? "warmup" : "steady" };
  const sellerHeaders = authedHeaders(data.sellerToken);

  const res = http.get(`${BASE_URL}/products/`, { headers: sellerHeaders, tags });

  check(res, { "L3: 200 autenticado": () => res.status === 200 });
  sleep(0.2);
}
