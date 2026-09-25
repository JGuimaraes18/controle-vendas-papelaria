import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:80/api";
export const VUS = Number(__ENV.K6_VUS || 1);

export const ADMIN_EMAIL = "load.admin@testes.local";
export const ADMIN_PASSWORD = "admin123";
export const SELLER_EMAIL = "load.seller1@testes.local";
export const SELLER_PASSWORD = "seller123";

export function login(email, password, tags) {
  const res = http.post(`${BASE_URL}/login/`, JSON.stringify({ email, password }), {
    headers: { "Content-Type": "application/json" },
    tags: tags || undefined,
  });

  if (res.status !== 200) {
    return null;
  }

  return res.json().access;
}

// SimpleJWT emite access token com ACCESS_TOKEN_LIFETIME de 15 min
// (backend/core/settings.py). Runs mais longos que isso precisam
// reautenticar, senao todo endpoint autenticado passa a responder 401.
export const SESSION_TTL_MS = 11 * 60 * 1000;

export const SESSION_CREDENTIALS = {
  admin: [ADMIN_EMAIL, ADMIN_PASSWORD],
  seller: [SELLER_EMAIL, SELLER_PASSWORD],
  seller2: ["load.seller2@testes.local", SELLER_PASSWORD],
};

// Devolve os headers autenticados do papel pedido, reautenticando quando o
// token estiver proximo do vencimento. `data` e uma copia por VU, entao cada
// VU renova o proprio token sem interferir nos demais.
//
// O VU nasce com a idade real do token do setup (`setupAt`): sem isso, um VU
// criado no stage_50 marcaria o token de 15 min como se tivesse acabado de
// ser emitido e soDiscoveriria a expiracao no meio da propria medicao.
export function sessionHeaders(data, role) {
  const now = Date.now();

  if (!data.sessions) {
    data.sessions = {};
  }
  if (!data.sessions[role]) {
    data.sessions[role] = { token: data[`${role}Token`], issuedAt: data.setupAt || 0 };
  }
  if (now - data.sessions[role].issuedAt > SESSION_TTL_MS) {
    const [email, password] = SESSION_CREDENTIALS[role];
    const token = login(email, password, { stage: "reauth" });
    if (!token) {
      throw new Error(`Falha ao reautenticar o papel ${role}`);
    }
    data.sessions[role] = { token, issuedAt: now };
  }

  return authedHeaders(data.sessions[role].token);
}

export function authedHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function discoverProductIds(token) {
  const res = http.get(`${BASE_URL}/products/`, { headers: authedHeaders(token) });
  if (res.status !== 200) {
    return [];
  }

  const body = res.json();
  const items = Array.isArray(body) ? body : body.results || [];

  return items
    .filter((p) => p.description && p.description.startsWith("Produto Carga"))
    .map((p) => p.id);
}

export function discoverCustomerIds(token) {
  const res = http.get(`${BASE_URL}/customers/`, { headers: authedHeaders(token) });
  if (res.status !== 200) {
    return [];
  }

  const body = res.json();
  const items = Array.isArray(body) ? body : body.results || [];

  return items
    .filter((c) => c.email && c.email.startsWith("load.cliente"))
    .map((c) => c.id);
}

export function discoverSellerIds(token) {
  const res = http.get(`${BASE_URL}/sellers/`, { headers: authedHeaders(token) });
  if (res.status !== 200) {
    return [];
  }

  const body = res.json();
  const items = Array.isArray(body) ? body : body.results || [];

  return items
    .filter((s) => s.email && s.email.startsWith("load.seller"))
    .map((s) => s.id);
}

export function setStock(token, productId, stock) {
  const res = http.patch(
    `${BASE_URL}/products/${productId}/`,
    JSON.stringify({
      stock_quantity: stock,
    }),
    { headers: authedHeaders(token) },
  );
  return res.status;
}

export function resetAllStock(token, productIds, stock) {
  const failures = [];

  for (const productId of productIds) {
    const status = setStock(token, productId, stock);
    if (status !== 200) {
      failures.push(`${productId}: HTTP ${status}`);
    }
  }

  return failures;
}

export function ensureStock(token, productIds, stock) {
  const now = resetAllStock(token, productIds, stock);
  if (now.length) {
    throw new Error(`Falha ao setar estoque: ${now.join("; ")}`);
  }
}

export function fullSetup() {
  const setupAt = Date.now();
  const adminToken = login(ADMIN_EMAIL, ADMIN_PASSWORD, { stage: "setup" });
  const sellerToken = login(SELLER_EMAIL, SELLER_PASSWORD, { stage: "setup" });
  const seller2Token = login("load.seller2@testes.local", SELLER_PASSWORD, { stage: "setup" });

  if (!adminToken || !sellerToken || !seller2Token) {
    throw new Error("Falha no login do setup (seed_load ausente?)");
  }

  const productIds = discoverProductIds(adminToken);
  const customerIds = discoverCustomerIds(adminToken);
  const sellerIds = discoverSellerIds(adminToken);

  if (productIds.length < 3) {
    throw new Error(`Esperava ao menos 3 produtos de carga, obteve ${productIds.length}`);
  }
  if (customerIds.length < 3) {
    throw new Error(`Esperava ao menos 3 clientes de carga, obteve ${customerIds.length}`);
  }
  if (sellerIds.length < 1) {
    throw new Error(`Esperava ao menos 1 vendedor de carga, obteve ${sellerIds.length}`);
  }

  return { setupAt, adminToken, sellerToken, seller2Token, productIds, customerIds, sellerIds };
}