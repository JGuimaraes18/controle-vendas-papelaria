import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import { BASE_URL, authedHeaders, fullSetup, setStock } from "./common.js";

export const createdCounter = new Counter("created");
export const cancelledCounter = new Counter("cancelled");
export const serverErrorCounter = new Counter("server_error");

export const options = {
  scenarios: {
    createAndCancel: {
      executor: "shared-iterations",
      vus: 20,
      iterations: 40,
      maxDuration: "3m",
    },
  },
  thresholds: {
    server_error: ["count==0"],
  },
};

export function setup() {
  const data = fullSetup();
  const productId = data.productIds[0];

  const status = setStock(data.adminToken, productId, 100);

  if (status !== 200) {
    throw new Error(`reset de estoque falhou (HTTP ${status})`);
  }

  return { ...data, productId, buyerId: data.customerIds[0], sellerId: data.sellerIds[0] };
}

export default function (data) {
  const saleRes = http.post(
    `${BASE_URL}/sales/`,
    JSON.stringify({
      customer: data.buyerId,
      seller: data.sellerId,
      items: [{ product: data.productId, quantity: 1 }],
    }),
    { headers: authedHeaders(data.sellerToken) },
  );

  check(saleRes, { "venda criada (201)": () => saleRes.status === 201 });

  if (saleRes.status !== 201) {
    if (saleRes.status >= 500) serverErrorCounter.add(1);
    sleep(0.2);
    return;
  }

  createdCounter.add(1);

  const saleId = saleRes.json().id;

  const cancelRes = http.post(
    `${BASE_URL}/sales/${saleId}/cancel/`,
    JSON.stringify({ reason: "Cancelamento teste de carga e stress com k6." }),
    { headers: authedHeaders(data.adminToken) },
  );

  check(cancelRes, { "cancelamento ok (200)": () => cancelRes.status === 200 });

  if (cancelRes.status === 200) {
    cancelledCounter.add(1);
  } else if (cancelRes.status >= 500) {
    serverErrorCounter.add(1);
  }

  sleep(0.2);
}