import http from "k6/http";

import { BASE_URL, authedHeaders, fullSetup } from "./common.js";

export const options = {
  scenarios: {
    verify: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
    },
  },
};

export function setup() {
  return fullSetup();
}

export default function (data) {
  const headers = authedHeaders(data.adminToken);
  const stockBefore = __ENV.STOCK_BEFORE ? Number(__ENV.STOCK_BEFORE) : null;
  const productId = __ENV.PRODUCT_ID || 7;

  const res = http.get(`${BASE_URL}/products/${productId}/`, { headers });

  if (res.status !== 200) {
    console.error(`Falha ao consultar produto ${productId}: HTTP ${res.status}`);
    return;
  }

  const product = res.json();
  const stockAfter = product.stock_quantity;

  console.log(`PRODUCT=${product.id} STOCK_AFTER=${stockAfter}`);

  if (stockAfter < 0) {
    throw new Error(`ESTOQUE NEGATIVO DETECTADO: ${stockAfter}`);
  }
}