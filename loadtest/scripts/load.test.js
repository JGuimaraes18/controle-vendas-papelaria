import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import {
  BASE_URL, authedHeaders, fullSetup, ensureStock,
} from "./common.js";

export const serverErrorCounter = new Counter("server_error");
export const insufficientCounter = new Counter("insufficient");

export const options = {
  setupTimeout: "180s",
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "2m", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    server_error: ["count==0"],
    http_req_duration: ["p(95)<2000"],
  },
};

export function setup() {
  const data = fullSetup();
  ensureStock(data.adminToken, data.productIds, 5000);
  return data;
}

export default function (data) {
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
      { headers: sellerHeaders },
    );

    if (saleRes.status === 400) {
      insufficientCounter.add(1);
    } else if (saleRes.status >= 500) {
      serverErrorCounter.add(1);
    }

    check(saleRes, { "criar venda: 201/400, sem 5xx": () => [201, 400].includes(saleRes.status) });
  } else if (roll < 0.85) {
    const list = http.get(`${BASE_URL}/sales/`, { headers: adminHeaders });
    check(list, { "GET /sales/ 200": () => list.status === 200 });

    const report = http.get(
      `${BASE_URL}/commissions/?start_date=2026-01-01&end_date=2026-12-31`,
      { headers: adminHeaders },
    );
    check(report, { "GET /commissions/ 200": () => report.status === 200 });
  } else if (roll < 0.95) {
    const history = http.get(
      `${BASE_URL}/customers/${data.customerIds[__VU % data.customerIds.length]}/purchase-history/`,
      { headers: sellerHeaders },
    );
    check(history, { "GET purchase-history 200": () => history.status === 200 });
  } else {
    const products = http.get(`${BASE_URL}/products/`, { headers: sellerHeaders });
    check(products, { "GET /products/ 200": () => products.status === 200 });
  }

  sleep(0.5);
}