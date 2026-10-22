// ==============================================================================
// Resto+ — Tests d'intégration HTTP pour le module Commandes
// Cible : serveur Next.js de test local pointant sur base jetable isolée
// ==============================================================================

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const confirmation = process.env.RESTOPLUS_HTTP_TEST_CONFIRMATION;
const baseUrlValue = process.env.RESTOPLUS_HTTP_BASE_URL;
const appDatabaseUrl = process.env.RESTOPLUS_TEST_APP_DATABASE_URL;
const authDatabaseUrl = process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL;

const isConfigured = Boolean(
  confirmation === "isolated-disposable" &&
  baseUrlValue &&
  appDatabaseUrl &&
  authDatabaseUrl &&
  process.env.RESTOPLUS_HTTP_OWNER_A_EMAIL &&
  process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL &&
  process.env.RESTOPLUS_HTTP_OWNER_A_RESTAURANT_ID &&
  process.env.RESTOPLUS_HTTP_WAITER_A_USER_ID &&
  process.env.RESTOPLUS_HTTP_MENU_PRODUCT_ID &&
  process.env.RESTOPLUS_HTTP_TABLE_NUMBER,
);

let baseUrl;
let origin;
let appPool;
let authPool;

function sessionCookie(response) {
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  const match = cookieHeader.match(/(?:^|,\s*)restoplus_session=([^;,]+)/);
  return match?.[1] ? `restoplus_session=${match[1]}` : undefined;
}

async function post(path, body, cookie) {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

async function login(credentials) {
  const response = await post("/api/auth/login", credentials);
  assert.equal(
    response.status,
    200,
    "La connexion doit réussir pour le compte test",
  );
  const cookie = sessionCookie(response);
  assert.ok(cookie, "Le cookie de session doit être présent");
  return cookie;
}

async function withTenantRead(restaurantId, userId, callback) {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query(
      "SELECT set_config('app.restaurant_id', $1, true), set_config('app.user_id', $2, true)",
      [restaurantId, userId],
    );
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

before(async () => {
  if (!isConfigured) return;

  baseUrl = new URL(baseUrlValue);
  origin = baseUrl.origin;

  appPool = new Pool({ connectionString: appDatabaseUrl, max: 1 });
  authPool = new Pool({ connectionString: authDatabaseUrl, max: 1 });

  const identity = await appPool.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(identity.rows[0].role, "restoplus_app");
  assert.equal(identity.rows[0].db, "restoplus_test_disposable");
  const authIdentity = await authPool.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(authIdentity.rows[0].role, "restoplus_auth");
  assert.equal(authIdentity.rows[0].db, "restoplus_test_disposable");
});

after(async () => {
  await appPool?.end();
  await authPool?.end();
});

test(
  "Order endpoints reject unauthenticated requests with HTTP 401",
  { skip: !isConfigured },
  async () => {
    const response = await fetch(new URL("/api/orders", baseUrl), {
      method: "GET",
      redirect: "manual",
    });
    assert.equal(response.status, 401);
  },
);

test(
  "Order endpoints reject requests from invalid origins with HTTP 403",
  { skip: !isConfigured },
  async () => {
    const waiterCookie = await login({
      restaurantCode: process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
      email: process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
      password: process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
    });

    const response = await fetch(new URL("/api/orders", baseUrl), {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.example",
        cookie: waiterCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tableNumber: "Table 01",
        lines: [
          {
            productId: "poulet",
            productName: "Poulet",
            station: "CUISINE",
            quantity: 1,
            unitPriceAmount: 25000,
            currency: "CDF",
          },
        ],
      }),
    });

    assert.equal(response.status, 403);
  },
);

test(
  "Waiter cannot directly validate an order in cashier (HTTP 400/403)",
  { skip: !isConfigured },
  async () => {
    const waiterCookie = await login({
      restaurantCode: process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
      email: process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
      password: process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
    });

    const fakeOrderId = "00000000-0000-4000-8000-000000000099";
    const response = await post(
      `/api/orders/${fakeOrderId}/validate`,
      {},
      waiterCookie,
    );

    // Le serveur refuse car le rôle WAITER n'est pas caissier
    assert.ok(
      response.status === 400 || response.status === 403,
      `Attendu 400 ou 403 pour un serveur tentant de valider en caisse (reçu ${response.status})`,
    );
  },
);

test(
  "Order creation rejects browser-supplied prices, names and stations",
  { skip: !isConfigured },
  async () => {
    const waiterCookie = await login({
      restaurantCode: process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
      email: process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
      password: process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
    });

    const response = await post(
      "/api/orders",
      {
        tableNumber: "Table 01",
        lines: [
          {
            productId: "demo-product",
            productName: "Faux produit",
            station: "BAR",
            quantity: 1,
            unitPriceAmount: 1,
            currency: "USD",
          },
        ],
      },
      waiterCookie,
    );

    assert.equal(response.status, 400);
  },
);

test(
  "Order creation reads the price, currency and station from the persistent server catalogue",
  { skip: !isConfigured },
  async () => {
    const waiterCookie = await login({
      restaurantCode: process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
      email: process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
      password: process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
    });

    const response = await post(
      "/api/orders",
      {
        tableNumber: process.env.RESTOPLUS_HTTP_TABLE_NUMBER,
        lines: [{ productId: process.env.RESTOPLUS_HTTP_MENU_PRODUCT_ID, quantity: 1 }],
      },
      waiterCookie,
    );

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.status, "WAITING_CASHIER");
    assert.match(payload.orderId, /^[0-9a-f-]{36}$/i);

    const snapshot = await withTenantRead(
      process.env.RESTOPLUS_HTTP_OWNER_A_RESTAURANT_ID,
      process.env.RESTOPLUS_HTTP_WAITER_A_USER_ID,
      (client) => client.query(
        `SELECT l."productName", l."station", l."unitPriceAmount"::text AS "unitPriceAmount", l."currency"
         FROM public.order_lines l
         WHERE l."orderId" = $1::uuid`,
        [payload.orderId],
      ),
    );
    assert.equal(snapshot.rowCount, 1);
    assert.equal(snapshot.rows[0].productName, "Produit test catalogue");
    assert.equal(snapshot.rows[0].station, "CUISINE");
    assert.equal(snapshot.rows[0].unitPriceAmount, "12500.00");
    assert.equal(snapshot.rows[0].currency, "CDF");
  },
);
