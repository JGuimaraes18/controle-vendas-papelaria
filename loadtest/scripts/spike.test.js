import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import { BASE_URL, authedHeaders, fullSetup, ensureStock } from "./common.js";

export const serverErrorCounter = new Counter("server_error");
export const insufficientCounter = new Counter("insufficient");

export const options = {
  setupTimeout: "180s",
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    server_error: ["count==0"],
    http_req_duration: ["p(95)<3000"],
  },
};

export function setup() {
  const data = fullSetup();
  ensureStock(data.adminToken, data.productIds, 5000);
  return data;
}

export default function (data) {
  const headers = authedHeaders(data.sellerToken);

  const productId = data.productIds[__VU % data.productIds.length];
  const customerId = data.customerIds[__VU % data.customerIds.length];
  const sellerId = data.sellerIds[__VU % data.sellerIds.length];

  const res = http.post(
    `${BASE_URL}/sales/`,
    JSON.stringify({
      customer: customerId,
      seller: sellerId,
      items: [{ product: productId, quantity: 1 }],
    }),
    { headers },
  );

  if (res.status === 400) {
    insufficientCounter.add(1);
  } else if (res.status >= 500) {
    serverErrorCounter.add(1);
  }

  check(res, { "criar venda: 201/400, sem 5xx": () => [201, 400].includes(res.status) });

  sleep(0.1);
}