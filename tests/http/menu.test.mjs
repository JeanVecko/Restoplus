// HTTP tests for persistent catalogue routes.
// Writes are allowed only against the guarded disposable test environment.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";

const confirmation = process.env.RESTOPLUS_HTTP_TEST_CONFIRMATION;
const baseUrlValue = process.env.RESTOPLUS_HTTP_BASE_URL;
const configured = Boolean(
  confirmation === "isolated-disposable" &&
  baseUrlValue &&
  process.env.RESTOPLUS_TEST_APP_DATABASE_URL &&
  process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL &&
  process.env.RESTOPLUS_HTTP_MANAGER_A_CODE &&
  process.env.RESTOPLUS_HTTP_MANAGER_A_EMAIL &&
  process.env.RESTOPLUS_HTTP_MANAGER_A_PASSWORD &&
  process.env.RESTOPLUS_HTTP_WAITER_A_CODE &&
  process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL &&
  process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
);

let baseUrl;
let origin;

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie") ?? "";
  const match = cookie.match(/(?:^|,\s*)restoplus_session=([^;,]+)/);
  return match?.[1] ? `restoplus_session=${match[1]}` : undefined;
}

async function login(code, email, password) {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ restaurantCode: code, email, password }),
    redirect: "manual",
  });
  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  assert.ok(cookie);
  return cookie;
}

async function post(path, body, cookie) {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

before(() => {
  if (!configured) return;
  baseUrl = new URL(baseUrlValue);
  origin = baseUrl.origin;
});

test("catalog GET requires an authenticated restaurant member", { skip: !configured }, async () => {
  const response = await fetch(new URL("/api/menu", baseUrl), { redirect: "manual" });
  assert.equal(response.status, 401);
});

test("only OWNER and MANAGER can create catalog entries", { skip: !configured }, async () => {
  const managerCookie = await login(
    process.env.RESTOPLUS_HTTP_MANAGER_A_CODE,
    process.env.RESTOPLUS_HTTP_MANAGER_A_EMAIL,
    process.env.RESTOPLUS_HTTP_MANAGER_A_PASSWORD,
  );
  const waiterCookie = await login(
    process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
    process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
    process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
  );

  const denied = await post("/api/menu/categories", { name: "Refusée" }, waiterCookie);
  assert.equal(denied.status, 403);

  const categoryResponse = await post(
    "/api/menu/categories",
    { name: `Catégorie HTTP ${randomUUID()}` },
    managerCookie,
  );
  assert.equal(categoryResponse.status, 201);
  const category = await categoryResponse.json();
  assert.match(category.id, /^[0-9a-f-]{36}$/i);

  const forgedTenant = await post(
    "/api/menu/products",
    {
      restaurantId: "00000000-0000-4000-8000-000000000001",
      categoryId: category.id,
      name: "Prix client",
      preparationStation: "CUISINE",
      currency: "USD",
      standardPriceAmount: "1.00",
    },
    managerCookie,
  );
  assert.equal(forgedTenant.status, 400);

  const productResponse = await post(
    "/api/menu/products",
    {
      categoryId: category.id,
      name: `Article HTTP ${randomUUID()}`,
      preparationStation: "BAR",
      currency: "USD",
      standardPriceAmount: "3.50",
      zonePrices: [{ zone: "VIP", priceAmount: "5.00" }],
      variants: [{
        name: "Grand",
        standardPriceAmount: "4.25",
        zonePrices: [{ zone: "TERRACE", priceAmount: "4.75" }],
      }],
      options: [
        { name: "Citron", kind: "INCLUDED", priceAmount: "0" },
        { name: "Sirop", kind: "PAID", priceAmount: "0.50" },
      ],
    },
    managerCookie,
  );
  assert.equal(productResponse.status, 201);
  const product = await productResponse.json();
  assert.match(product.id, /^[0-9a-f-]{36}$/i);

  const listedResponse = await fetch(new URL("/api/menu", baseUrl), {
    headers: { cookie: managerCookie },
    cache: "no-store",
  });
  assert.equal(listedResponse.status, 200);
  const listed = await listedResponse.json();
  const stored = listed.products.find((entry) => entry.id === product.id);
  assert.ok(stored);
  assert.equal(stored.price.amount, "3.50");
  assert.equal(stored.price.currency, "USD");
  assert.equal(stored.preparationStation, "BAR");
  assert.equal(stored.variants[0].zonePrices.TERRACE, "4.75");
  assert.equal(stored.paidExtras[0].priceAmount, "0.50");
});
