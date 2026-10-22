import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const confirmation = process.env.RESTOPLUS_HTTP_TEST_CONFIRMATION;
const baseUrlValue = process.env.RESTOPLUS_HTTP_BASE_URL;
const appDatabaseUrl = process.env.RESTOPLUS_TEST_APP_DATABASE_URL;
const authDatabaseUrl = process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL;
const requiredEnvironment = [
  "RESTOPLUS_HTTP_TEST_CONFIRMATION",
  "RESTOPLUS_HTTP_BASE_URL",
  "RESTOPLUS_TEST_APP_DATABASE_URL",
  "RESTOPLUS_TEST_AUTH_DATABASE_URL",
  "APP_DATABASE_URL",
  "AUTH_DATABASE_URL",
  "RESTOPLUS_HTTP_OWNER_A_CODE",
  "RESTOPLUS_HTTP_OWNER_A_EMAIL",
  "RESTOPLUS_HTTP_OWNER_A_PASSWORD",
  "RESTOPLUS_HTTP_MANAGER_A_CODE",
  "RESTOPLUS_HTTP_MANAGER_A_EMAIL",
  "RESTOPLUS_HTTP_MANAGER_A_PASSWORD",
  "RESTOPLUS_HTTP_WAITER_A_CODE",
  "RESTOPLUS_HTTP_WAITER_A_EMAIL",
  "RESTOPLUS_HTTP_WAITER_A_PASSWORD",
  "RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME",
  "RESTOPLUS_HTTP_OWNER_A_USER_ID",
  "RESTOPLUS_HTTP_OWNER_B_USER_ID",
  "RESTOPLUS_HTTP_TENANT_B_DISPLAY_NAME",
];

const ownerA = {
  restaurantCode: process.env.RESTOPLUS_HTTP_OWNER_A_CODE,
  email: process.env.RESTOPLUS_HTTP_OWNER_A_EMAIL,
  password: process.env.RESTOPLUS_HTTP_OWNER_A_PASSWORD,
};
const managerA = {
  restaurantCode: process.env.RESTOPLUS_HTTP_MANAGER_A_CODE,
  email: process.env.RESTOPLUS_HTTP_MANAGER_A_EMAIL,
  password: process.env.RESTOPLUS_HTTP_MANAGER_A_PASSWORD,
};
const waiterA = {
  restaurantCode: process.env.RESTOPLUS_HTTP_WAITER_A_CODE,
  email: process.env.RESTOPLUS_HTTP_WAITER_A_EMAIL,
  password: process.env.RESTOPLUS_HTTP_WAITER_A_PASSWORD,
};

const isConfigured =
  confirmation === "isolated-disposable" &&
  requiredEnvironment.every((name) => Boolean(process.env[name]));

let appPool;
let authPool;
let baseUrl;
let origin;

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
  assert.equal(response.status, 200, "test account login should succeed");
  const cookie = sessionCookie(response);
  assert.ok(cookie, "successful login should set the session cookie");
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Path=\//i);
  assert.equal(
    response.headers.get("cache-control")?.includes("no-store"),
    true,
  );
  return cookie;
}

async function members(cookie) {
  return fetch(new URL("/api/members", baseUrl), {
    headers: { cookie },
    redirect: "manual",
  });
}

before(async () => {
  if (!isConfigured) return;

  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  assert.deepEqual(
    missing,
    [],
    `Configure the isolated HTTP test environment variables: ${missing.join(", ")}`,
  );
  assert.equal(
    confirmation,
    "isolated-disposable",
    "HTTP tests require explicit confirmation of a disposable test database",
  );
  assert.equal(
    process.env.APP_DATABASE_URL === appDatabaseUrl,
    true,
    "the Next.js app connection must match the isolated test connection",
  );
  assert.equal(
    process.env.AUTH_DATABASE_URL === authDatabaseUrl,
    true,
    "the Next.js auth connection must match the isolated test connection",
  );

  baseUrl = new URL(baseUrlValue);
  assert.equal(
    baseUrl.protocol,
    "http:",
    "the test server must use local HTTP",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname),
    "the test server must be loopback-only",
  );
  origin = baseUrl.origin;
  assert.match(
    process.env.RESTOPLUS_HTTP_OWNER_B_USER_ID,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "the cross-tenant fixture must use a UUID",
  );

  appPool = new Pool({ connectionString: appDatabaseUrl, max: 1 });
  authPool = new Pool({ connectionString: authDatabaseUrl, max: 1 });
  const [appIdentity, authIdentity] = await Promise.all([
    appPool.query(
      "SELECT current_database() AS db, current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port",
    ),
    authPool.query(
      "SELECT current_database() AS db, current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port",
    ),
  ]);
  assert.equal(appIdentity.rows[0].role, "restoplus_app");
  assert.equal(authIdentity.rows[0].role, "restoplus_auth");
  assert.match(appIdentity.rows[0].db, /^restoplus_test_[a-z0-9_]+$/i);
  assert.equal(authIdentity.rows[0].db, appIdentity.rows[0].db);
  assert.equal(authIdentity.rows[0].address, appIdentity.rows[0].address);
  assert.equal(authIdentity.rows[0].port, appIdentity.rows[0].port);

  const health = await fetch(baseUrl, { redirect: "manual" });
  assert.ok(health.status < 500, "the local Next.js server must be responding");
});

after(async () => {
  await appPool?.end();
  await authPool?.end();
});

test("login rejects invalid input and credentials without exposing details", { skip: !isConfigured }, async () => {
  const noOrigin = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(noOrigin.status, 403);
  assert.equal(sessionCookie(noOrigin), undefined);

  const malformed = await post("/api/auth/login", { ...ownerA, password: "" });
  assert.equal(malformed.status, 400);
  assert.equal(sessionCookie(malformed), undefined);

  const incorrect = await post("/api/auth/login", {
    ...ownerA,
    password: `${ownerA.password}-incorrect`,
  });
  assert.equal(incorrect.status, 401);
  assert.equal(sessionCookie(incorrect), undefined);
  const body = await incorrect.text();
  assert.equal(body.includes(ownerA.email), false);
  assert.equal(
    incorrect.headers.get("cache-control")?.includes("no-store"),
    true,
  );
});

test("restaurant reactivation rejects foreign origins and invalid input", { skip: !isConfigured }, async () => {
  const foreignOrigin = await fetch(
    new URL("/api/auth/reactivate-restaurant", baseUrl),
    {
      method: "POST",
      headers: {
        origin: "https://invalid.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  assert.equal(foreignOrigin.status, 403);

  const invalid = await post("/api/auth/reactivate-restaurant", {});
  assert.equal(invalid.status, 400);
  assert.equal(sessionCookie(invalid), undefined);
  assert.equal(
    invalid.headers.get("cache-control")?.includes("no-store"),
    true,
  );
});

test("member routes require a session and restrict operational members", { skip: !isConfigured }, async () => {
  const unauthenticated = await members("");
  assert.equal(unauthenticated.status, 401);

  const operationalCookie = await login(waiterA);
  const forbidden = await members(operationalCookie);
  assert.equal(forbidden.status, 403);
});

test("OWNER and MANAGER member listings remain inside restaurant A", { skip: !isConfigured }, async () => {
  for (const credentials of [ownerA, managerA]) {
    const response = await members(await login(credentials));
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(
      body.includes(process.env.RESTOPLUS_HTTP_TENANT_B_DISPLAY_NAME),
      false,
      "tenant A response must not contain the tenant B fixture marker",
    );
  }
});

test("MANAGER cannot promote a member to OWNER or modify another tenant", { skip: !isConfigured }, async () => {
  const cookie = await login(managerA);
  const listing = await members(cookie);
  assert.equal(listing.status, 200);
  const payload = await listing.json();
  const waiter = payload.members.find(
    (member) =>
      member.displayName === process.env.RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME,
  );
  assert.ok(waiter?.id, "tenant A waiter fixture must appear in the list");

  const operationalChange = await fetch(
    new URL(`/api/members/${waiter.id}`, baseUrl),
    {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "KITCHEN" }),
      redirect: "manual",
    },
  );
  assert.equal(operationalChange.status, 200);
  const restoreRole = await fetch(
    new URL(`/api/members/${waiter.id}`, baseUrl),
    {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "WAITER" }),
      redirect: "manual",
    },
  );
  assert.equal(restoreRole.status, 200);

  const promotion = await fetch(new URL(`/api/members/${waiter.id}`, baseUrl), {
    method: "PATCH",
    headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify({ role: "OWNER" }),
    redirect: "manual",
  });
  assert.equal(promotion.status, 403);

  const manager = payload.members.find(
    (member) => member.membership?.role === "MANAGER",
  );
  assert.ok(manager?.id, "tenant A manager fixture must appear in the list");
  const selfPromotion = await fetch(
    new URL(`/api/members/${manager.id}`, baseUrl),
    {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "OWNER" }),
      redirect: "manual",
    },
  );
  assert.equal(selfPromotion.status, 403);

  const crossTenant = await fetch(
    new URL(
      `/api/members/${process.env.RESTOPLUS_HTTP_OWNER_B_USER_ID}`,
      baseUrl,
    ),
    {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "KITCHEN" }),
      redirect: "manual",
    },
  );
  assert.ok([404, 409].includes(crossTenant.status));
});

test("OWNER can promote another member and cannot disable the last OWNER", { skip: !isConfigured }, async () => {
  const cookie = await login(ownerA);
  const listing = await members(cookie);
  assert.equal(listing.status, 200);
  const payload = await listing.json();
  const waiter = payload.members.find(
    (member) =>
      member.displayName === process.env.RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME,
  );
  assert.ok(waiter?.id, "tenant A waiter fixture must appear in the list");

  const promote = (role) =>
    fetch(new URL(`/api/members/${waiter.id}`, baseUrl), {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ role }),
      redirect: "manual",
    });
  const promoted = await promote("OWNER");
  assert.equal(promoted.status, 200);
  const restored = await promote("WAITER");
  assert.equal(restored.status, 200);

  const lastOwner = await fetch(
    new URL(
      `/api/members/${process.env.RESTOPLUS_HTTP_OWNER_A_USER_ID}`,
      baseUrl,
    ),
    {
      method: "PATCH",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ membershipActive: false }),
      redirect: "manual",
    },
  );
  assert.equal(lastOwner.status, 409);
});

test("invitation can be accepted once and replay is refused", { skip: !isConfigured }, async () => {
  const cookie = await login(managerA);
  const create = await post(
    "/api/members",
    {
      email: `http-${randomUUID()}@example.invalid`,
      role: "CASHIER",
    },
    cookie,
  );
  assert.equal(create.status, 201);
  const invitation = await create.json();
  assert.equal(
    /^[A-Za-z0-9_-]{43}$/.test(invitation.invitationToken),
    true,
    "the one-time invitation token must have the expected opaque format",
  );
  assert.equal(create.headers.get("cache-control")?.includes("no-store"), true);

  const accept = () =>
    post("/api/invitations/accept", {
      token: invitation.invitationToken,
      displayName: "Compte HTTP synthétique",
      password: `T-${randomUUID()}-MotDePasse!`,
    });
  const accepted = await accept();
  assert.equal(accepted.status, 200);
  assert.ok(sessionCookie(accepted));
  const replay = await post("/api/invitations/accept", {
    token: invitation.invitationToken,
    displayName: "Rejeu synthétique",
    password: `T-${randomUUID()}-MotDePasse!`,
  });
  assert.equal(replay.status, 400);
});

test("logout revokes the session and the old cookie is refused", { skip: !isConfigured }, async () => {
  const cookie = await login(ownerA);
  const logout = await post("/api/auth/logout", {}, cookie);
  assert.equal(logout.status, 200);

  const oldSession = await members(cookie);
  assert.equal(oldSession.status, 401);
});

test("MANAGER cannot deactivate the restaurant", { skip: !isConfigured }, async () => {
  const response = await post(
    "/api/restaurant/deactivate",
    {},
    await login(managerA),
  );
  assert.equal(response.status, 403);
});

