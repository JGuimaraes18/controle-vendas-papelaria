import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import {
  BASE_URL, authedHeaders, fullSetup, ensureStock,
} from "./common.js";

// E1 - latencia de servico sem concorrencia.
//
// Mesmo mix do load.test.js (70/15/10/5) com 1 unico VU, de modo que a
// latencia observada se aproxima do tempo de servico: nao ha fila para
// disgultar o custo de cada statement. As 5 primeiras iteracoes sao marcadas
// com a tag warmup e ficam fora da analise de percentis.
//
// Execucao:
//   docker run --rm --network host --user "$(id -u):$(id -g)" \
//     -e BASE_URL=http://localhost:80/api \
//     -v "$PWD/loadtest/scripts":/scripts:ro \
//     -v "$PWD/loadtest/results":/results grafana/k6:latest run \
//     --summary-trend-stats="avg,p(90),p(95),p(99),max" \
//     --out json=/results/e1-single-vu.test.json /scripts/e1-single-vu.test.js

export const serverErrorCounter = new Counter("server_error");
export const insufficientCounter = new Counter("insufficient");

const WARMUP_ITERATIONS = 5;

let iterations = 0;

export const options = {
  setupTimeout: "300s",
  scenarios: {
    single_vu: {
      executor: "constant-vus",
      vus: 1,
      duration: "720s",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    // Sem threshold de p95 aqui: o objetivo e medir a latencia, nao reprovar.
    server_error: ["count==0"],
    http_req_failed: ["rate<0.001"],
  },
};

export function setup() {
  const data = fullSetup();
  ensureStock(data.adminToken, data.productIds, 5000);
  return data;
}

export default function (data) {
  iterations += 1;
  const stage = iterations <= WARMUP_ITERATIONS ? "warmup" : "steady";
  const tags = { stage, vu: "1" };
  const adminHeaders = authedHeaders(data.adminToken);
  const sellerHeaders = authedHeaders(data.sellerToken);
  const roll = Math.random();

  if (roll < 0.7) {
    const productId = data.productIds[__VU % data.productIds.length];
    const customerId = data.customerIds[__VU % data.customerIds.length];
    const sellerId = data.sellerIds[__VU % data.sellerIds.length];

    const saleRes = http.post(
      `${BASE_URL}/sales/`,
      JSON.stringify({
        customer: customerId,
        seller: sellerId,
        items: [{ product: productId, quantity: 1 }],
      }),
      { headers: sellerHeaders, tags },
    );

    if (saleRes.status === 400) {
      insufficientCounter.add(1, tags);
    } else if (saleRes.status >= 500) {
      serverErrorCounter.add(1, tags);
    }

    check(saleRes, {
      "criar venda: 201/400, sem 5xx": () => [201, 400].includes(saleRes.status),
    });
  } else if (roll < 0.85) {
    const list = http.get(`${BASE_URL}/sales/`, { headers: adminHeaders, tags });
    check(list, { "GET /sales/ 200": () => list.status === 200 });

    const report = http.get(
      `${BASE_URL}/commissions/?start_date=2026-01-01&end_date=2026-12-31`,
      { headers: adminHeaders, tags },
    );
    check(report, { "GET /commissions/ 200": () => report.status === 200 });
  } else if (roll < 0.95) {
    const history = http.get(
      `${BASE_URL}/customers/${data.customerIds[__VU % data.customerIds.length]}/purchase-history/`,
      { headers: sellerHeaders, tags },
    );
    check(history, { "GET purchase-history 200": () => history.status === 200 });
  } else {
    const products = http.get(`${BASE_URL}/products/`, { headers: sellerHeaders, tags });
    check(products, { "GET /products/ 200": () => products.status === 200 });
  }

  sleep(0.5);
}
