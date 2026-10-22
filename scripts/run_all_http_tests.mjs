import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { URL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const pg = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const appRaw = process.env.APP_DATABASE_URL;
if (!appRaw) throw new Error("APP_DATABASE_URL absent");

const appParsed = new URL(appRaw);
appParsed.pathname = "/restoplus_test_disposable";
const testAppUrl = appParsed.toString();

const authParsed = new URL(appRaw);
authParsed.username = "restoplus_auth";
authParsed.pathname = "/restoplus_test_disposable";
const testAuthUrl = authParsed.toString();

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres:Sengea@2023@127.0.0.1:5432/restoplus_test_disposable?schema=public",
});

async function getFixtures() {
  const restoA = await pool.query(
    `SELECT id, name, "publicCode" FROM public.restaurants WHERE name = 'Restaurant Test A' ORDER BY "createdAt" DESC LIMIT 1`
  );
  const restoB = await pool.query(
    `SELECT id, name, "publicCode" FROM public.restaurants WHERE name = 'Restaurant Test B' ORDER BY "createdAt" DESC LIMIT 1`
  );

  assert.ok(restoA.rows[0], "Restaurant Test A introuvable dans restoplus_test_disposable");
  assert.ok(restoB.rows[0], "Restaurant Test B introuvable dans restoplus_test_disposable");

  const resA = restoA.rows[0];
  const resB = restoB.rows[0];

  const membersA = await pool.query(
    `SELECT u.id, u."displayName", c."emailNormalized", m.role
     FROM public.users u
     JOIN public.auth_credentials c ON c."userId" = u.id AND c."restaurantId" = u."restaurantId"
     JOIN public.memberships m ON m."userId" = u.id AND m."restaurantId" = u."restaurantId"
     WHERE u."restaurantId" = $1::uuid`,
    [resA.id]
  );

  const ownerA = membersA.rows.find((m) => m.role === "OWNER");
  const managerA = membersA.rows.find((m) => m.role === "MANAGER");
  const waiterA = membersA.rows.find((m) => m.role === "WAITER");

  const ownerB = await pool.query(
    `SELECT u.id, u."displayName" FROM public.users u
     JOIN public.memberships m ON m."userId" = u.id AND m."restaurantId" = u."restaurantId"
     WHERE u."restaurantId" = $1::uuid AND m.role = 'OWNER'`,
    [resB.id]
  );

  const prod = await pool.query(
    `SELECT id, name FROM public.menu_products WHERE "restaurantId" = $1::uuid AND name = 'Produit test catalogue' ORDER BY "createdAt" DESC LIMIT 1`,
    [resA.id]
  );

  const table = await pool.query(
    `SELECT id, "tableNumber" FROM public.dining_tables WHERE "restaurantId" = $1::uuid AND "tableNumber" = 'Table HTTP test' LIMIT 1`,
    [resA.id]
  );

  assert.ok(ownerA, "Propriétaire A introuvable");
  assert.ok(managerA, "Manager A introuvable");
  assert.ok(waiterA, "Serveur A introuvable");
  assert.ok(ownerB.rows[0], "Propriétaire B introuvable");
  assert.ok(prod.rows[0], "Produit test catalogue introuvable");
  assert.ok(table.rows[0], "Table HTTP test introuvable");

  return {
    codeA: resA.publicCode,
    tenantAId: resA.id,
    ownerAId: ownerA.id,
    ownerAEmail: ownerA.emailNormalized,
    managerAEmail: managerA.emailNormalized,
    waiterAId: waiterA.id,
    waiterAEmail: waiterA.emailNormalized,
    waiterADisplayName: waiterA.displayName,
    ownerBId: ownerB.rows[0].id,
    tenantBDisplayName: resB.name,
    productId: prod.rows[0].id,
    tableNumber: table.rows[0].tableNumber,
  };
}

async function runTest(testFile, env) {
  console.log(`\n======================================================================`);
  console.log(`LANCEMENT : node --test ${testFile}`);
  console.log(`======================================================================`);
  return new Promise((resolve) => {
    const child = spawn("node", ["--test", testFile], {
      cwd: process.cwd(),
      env,
      shell: true,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      resolve(code);
    });
  });
}

async function main() {
  const fix = await getFixtures();
  await pool.end();

  const testEnv = {
    ...process.env,
    RESTOPLUS_TEST_DATABASE_CONFIRMATION: "isolated-disposable",
    RESTOPLUS_HTTP_TEST_CONFIRMATION: "isolated-disposable",
    RESTOPLUS_HTTP_BASE_URL: "http://localhost:3000",
    RESTOPLUS_TEST_APP_DATABASE_URL: testAppUrl,
    RESTOPLUS_TEST_AUTH_DATABASE_URL: testAuthUrl,
    APP_DATABASE_URL: testAppUrl,
    AUTH_DATABASE_URL: testAuthUrl,

    RESTOPLUS_HTTP_OWNER_A_CODE: fix.codeA,
    RESTOPLUS_HTTP_OWNER_A_EMAIL: fix.ownerAEmail,
    RESTOPLUS_HTTP_OWNER_A_PASSWORD: "TestPassword123!",
    RESTOPLUS_HTTP_OWNER_A_USER_ID: fix.ownerAId,
    RESTOPLUS_HTTP_OWNER_A_RESTAURANT_ID: fix.tenantAId,

    RESTOPLUS_HTTP_MANAGER_A_CODE: fix.codeA,
    RESTOPLUS_HTTP_MANAGER_A_EMAIL: fix.managerAEmail,
    RESTOPLUS_HTTP_MANAGER_A_PASSWORD: "TestPassword123!",

    RESTOPLUS_HTTP_WAITER_A_CODE: fix.codeA,
    RESTOPLUS_HTTP_WAITER_A_EMAIL: fix.waiterAEmail,
    RESTOPLUS_HTTP_WAITER_A_PASSWORD: "TestPassword123!",
    RESTOPLUS_HTTP_WAITER_A_USER_ID: fix.waiterAId,
    RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME: fix.waiterADisplayName,

    RESTOPLUS_HTTP_OWNER_B_USER_ID: fix.ownerBId,
    RESTOPLUS_HTTP_TENANT_B_DISPLAY_NAME: fix.tenantBDisplayName,

    RESTOPLUS_HTTP_MENU_PRODUCT_ID: fix.productId,
    RESTOPLUS_HTTP_TABLE_NUMBER: fix.tableNumber,
  };

  const results = {};

  results["test:http:menu"] = await runTest("tests/http/menu.test.mjs", testEnv);
  results["test:http:orders"] = await runTest("tests/http/orders.test.mjs", testEnv);
  results["test:http:security"] = await runTest("tests/http/security.test.mjs", testEnv);

  console.log("\n======================================================================");
  console.log("RÉSUMÉ FINAL DES SUITES DE TESTS HTTP AUTHENTIFIÉES :");
  console.log(`- test:http:menu    : ${results["test:http:menu"] === 0 ? "100% SUCCÈS" : "ÉCHEC"}`);
  console.log(`- test:http:orders  : ${results["test:http:orders"] === 0 ? "100% SUCCÈS" : "ÉCHEC"}`);
  console.log(`- test:http:security: ${results["test:http:security"] === 0 ? "100% SUCCÈS" : "ÉCHEC"}`);
  console.log("======================================================================");

  const allPassed = Object.values(results).every((code) => code === 0);
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erreur générale :", err);
  process.exit(1);
});
