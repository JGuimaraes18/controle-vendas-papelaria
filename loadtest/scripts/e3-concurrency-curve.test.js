import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import {
  BASE_URL, sessionHeaders, fullSetup, ensureStock,
} from "./common.js";

// E3 - curva de concorrencia em run unico.
//
// Seis cenarios constantemente concurrentes, nao sobrepostos (startTime
// acumulado), cada um ramping-vus ate N VUs e sustentando o patamar por 165 s.
// Todo request recebe a tag `stage`, o que permite fatiar o JSON por patamar
// depois do run. A rampa de 15 s antes do patamar evita transientes de
// inicio; a analise usa a janela inteira do cenario.
//
// Execucao:
//   docker run --rm --network host --user "$(id -u):$(id -g)" \
//     -e BASE_URL=http://localhost:80/api \
//     -v "$PWD/loadtest/scripts":/scripts:ro \
//     -v "$PWD/loadtest/results":/results grafana/k6:latest run \
//     --summary-trend-stats="avg,p(90),p(95),p(99),max" \
//     --out json=/results/e3-concurrency-curve.test.json \
//     /scripts/e3-concurrency-curve.test.js

export const serverErrorCounter = new Counter("server_error");
export const insufficientCounter = new Counter("insufficient");

const STAGE_DURATION = "165s";
const STAGE_RAMP = "15s";
const STAGE_DRAIN = "5s";

function stageScenario(vus, startTime) {
  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: STAGE_RAMP, target: vus },
      { duration: STAGE_DURATION, target: vus },
      { duration: STAGE_DRAIN, target: 0 },
    ],
    gracefulRampDown: "10s",
    startTime,
    exec: `stage${vus}`,
  };
}

export const options = {
  setupTimeout: "300s",
  scenarios: {
    stage_1: stageScenario(1, "0s"),
    stage_4: stageScenario(4, "200s"),
    stage_8: stageScenario(8, "400s"),
    stage_16: stageScenario(16, "600s"),
    stage_32: stageScenario(32, "800s"),
    stage_50: stageScenario(50, "1000s"),
  },
  thresholds: {
    // Sem threshold de p95: o objetivo e localizar o ponto de saturacao.
    // `checks` e o portao real: 400 por estoque e 401 por token expirado
    // entram em http_req_failed, mas reprovam aqui.
    server_error: ["count==0"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  const data = fullSetup();
  ensureStock(data.adminToken, data.productIds, 5000);
  return data;
}

function runIteration(data, stage) {
  const tags = { stage };
  const adminHeaders = sessionHeaders(data, "admin");
  const sellerHeaders = sessionHeaders(data, "seller");
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

export function stage1(data) { runIteration(data, "1"); }
export function stage4(data) { runIteration(data, "4"); }
export function stage8(data) { runIteration(data, "8"); }
export function stage16(data) { runIteration(data, "16"); }
export function stage32(data) { runIteration(data, "32"); }
export function stage50(data) { runIteration(data, "50"); }
