import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

import { BASE_URL, authedHeaders, fullSetup } from "./common.js";

export const options = {
  scenarios: {
    smoke: {
      executor: "shared-iterations",
      vus: 2,
      iterations: 4,
      maxDuration: "1m",
    },
  },
};

export function setup() {
  return fullSetup();
}

export default function (data) {
  const headers = authedHeaders(data.adminToken);

  const listProducts = http.get(`${BASE_URL}/products/`, { headers });
  check(listProducts, { "GET /products/ 200": () => listProducts.status === 200 });

  const sellerHeaders = authedHeaders(data.sellerToken);

  const saleRes = http.post(
    `${BASE_URL}/sales/`,
    JSON.stringify({
      customer: data.customerIds[0],
      seller: data.sellerIds[0],
      items: [{ product: data.productIds[2], quantity: 1 }],
    }),
    { headers: sellerHeaders },
  );

  check(saleRes, { "venda criada (201)": () => saleRes.status === 201 });

  if (saleRes.status === 201) {
    const saleId = saleRes.json().id;

    const history = http.get(`${BASE_URL}/sales/${saleId}/history/`, { headers });
    check(history, { "GET /sales/{id}/history/ 200": () => history.status === 200 });
  }

  sleep(0.2);
}