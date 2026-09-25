import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

import { BASE_URL, authedHeaders, fullSetup, setStock } from "./common.js";

export const stockCreated = new Counter("stock_created");
export const stockInsufficient = new Counter("stock_insufficient");
export const stockServerError = new Counter("stock_server_error");

export const options = {
  scenarios: {
    oversell: {
      executor: "shared-iterations",
      vus: 30,
      iterations: 70,
      maxDuration: "3m",
    },
  },
  thresholds: {
    stock_created: ["count==50"],
    stock_insufficient: ["count==20"],
    stock_server_error: ["count==0"],
  },
};

export function setup() {
  const data = fullSetup();
  const productId = data.productIds[0];

  const status = setStock(data.adminToken, productId, 50);

  if (status !== 200) {
    throw new Error(`reset de estoque falhou (HTTP ${status}). Seed/perm admin ausente?`);
  }

  return { ...data, productId, buyerId: data.customerIds[0], sellerId: data.sellerIds[0] };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/sales/`,
    JSON.stringify({
      customer: data.buyerId,
      seller: data.sellerId,
      items: [{ product: data.productId, quantity: 1 }],
    }),
    { headers: authedHeaders(data.sellerToken) },
  );

  if (res.status === 201) {
    stockCreated.add(1);
  } else if (res.status === 400) {
    stockInsufficient.add(1);
  } else if (res.status >= 500) {
    stockServerError.add(1);
  }

  check(res, {
    "201 (baixa ok) ou 400 (estoque insuficiente)": () =>
      res.status === 201 || res.status === 400,
    "zero erros 5xx": () => res.status < 500,
  });

  sleep(0.2);
}