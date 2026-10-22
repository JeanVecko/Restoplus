// ==============================================================================
// Resto+ — Initialisation des fixtures de test HTTP sur base isolée
// Cible : restoplus_test_disposable uniquement.
// NE S'EXÉCUTE JAMAIS sur restoplus_dev
// ==============================================================================

import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "../../src/server/auth/password.ts";

const { Pool } = pg;

const appUrl = process.env.RESTOPLUS_TEST_APP_DATABASE_URL;
const authUrl = process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL;

if (!appUrl || !authUrl) {
  console.error(
    "ERREUR: Définissez RESTOPLUS_TEST_APP_DATABASE_URL et RESTOPLUS_TEST_AUTH_DATABASE_URL.",
  );
  process.exit(1);
}

if (
  process.env.RESTOPLUS_TEST_DATABASE_CONFIRMATION !== "isolated-disposable"
) {
  console.error(
    "ERREUR: RESTOPLUS_TEST_DATABASE_CONFIRMATION='isolated-disposable' requis.",
  );
  process.exit(1);
}

const appPool = new Pool({ connectionString: appUrl, max: 2 });
const authPool = new Pool({ connectionString: authUrl, max: 2 });
const adminUrl = process.env.RESTOPLUS_TEST_ADMIN_DATABASE_URL;
const adminPool = adminUrl ? new Pool({ connectionString: adminUrl, max: 2 }) : null;

async function inTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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

async function setTenant(client, restaurantId, userId) {
  await client.query(
    "SELECT set_config('app.restaurant_id', $1, true), set_config('app.user_id', $2, true)",
    [restaurantId, userId],
  );
}

async function run() {
  try {
    console.log("Vérification de la base de test et des rôles...");
    const [identityRes, authIdentityRes] = await Promise.all([
      appPool.query(
        "SELECT current_database() AS db, current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port",
      ),
      authPool.query(
        "SELECT current_database() AS db, current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port",
      ),
    ]);

    const identity = identityRes.rows[0];
    const authIdentity = authIdentityRes.rows[0];

    assert.equal(identity.role, "restoplus_app");
    assert.equal(
      identity.db,
      "restoplus_test_disposable",
      "Refus d'exécution : cible autorisée restoplus_test_disposable uniquement.",
    );
    assert.equal(authIdentity.role, "restoplus_auth");
    assert.equal(authIdentity.db, identity.db);
    assert.equal(
      authIdentity.address,
      identity.address,
      "APP et AUTH doivent pointer vers le même hôte.",
    );
    assert.equal(
      authIdentity.port,
      identity.port,
      "APP et AUTH doivent pointer vers le même port.",
    );

    console.log(
      `Connexions validées sur ${identity.db} (${identity.address ?? "localhost"}:${identity.port}).`,
    );

    console.log("Vérification des tables requises par les migrations 1, 2 et 3...");
    const requiredTables = [
      "restaurants",
      "users",
      "auth_credentials",
      "memberships",
      "sessions",
      "membership_invitations",
      "security_audit_events",
      "dining_tables",
      "orders",
      "order_lines",
      "kitchen_bar_tickets",
      "receipts",
      "payments",
      "order_audit_events",
      "menu_categories",
      "menu_products",
      "menu_product_variants",
      "menu_product_options",
      "menu_product_zone_prices",
    ];

    const tablesCheck = await appPool.query(
      `SELECT c.relname AS table_name
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])`,
      [requiredTables],
    );
    const existing = new Set(tablesCheck.rows.map((r) => r.table_name));
    const missing = requiredTables.filter((t) => !existing.has(t));
    assert.equal(
      missing.length,
      0,
      `Migrations incomplètes sur ${identity.db}. Tables manquantes : ${missing.join(", ")}. Appliquez les migrations 1, 2 et 3 uniquement sur cette base jetable avant le seed.`,
    );

    console.log(`Base de test validée : ${identity.db}`);

    const tenantAId = randomUUID();
    const ownerAId = randomUUID();
    const codeA = `test-a-${randomUUID().slice(0, 6)}`;
    const emailOwnerA = "owner-a@test.invalid";
    const passwordOwnerA = "TestPassword123!";
    const hashOwnerA = await hashPassword(passwordOwnerA);

    const tenantBId = randomUUID();
    const ownerBId = randomUUID();
    const codeB = `test-b-${randomUUID().slice(0, 6)}`;
    const displayNameB = "Restaurant Test B";
    const hashOwnerB = await hashPassword("TestPassword123!");

    // 1. Bootstrap Tenant A
    console.log(`Création du Restaurant A (${codeA})...`);
    await inTransaction(authPool, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenantAId,
      ]);
      await client.query(
        `SELECT * FROM restoplus_private.bootstrap_restaurant_owner(
        $1::uuid, $2, $3, $4::uuid, $5, $6, $7
      )`,
        [
          tenantAId,
          codeA,
          "Restaurant Test A",
          ownerAId,
          "Propriétaire A",
          emailOwnerA,
          hashOwnerA,
        ],
      );
    });

    // 2. Bootstrap Tenant B
    console.log(`Création du Restaurant B (${codeB})...`);
    await inTransaction(authPool, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenantBId,
      ]);
      await client.query(
        `SELECT * FROM restoplus_private.bootstrap_restaurant_owner(
        $1::uuid, $2, $3, $4::uuid, $5, $6, $7
      )`,
        [
          tenantBId,
          codeB,
          displayNameB,
          ownerBId,
          "Propriétaire B",
          "owner-b@test.invalid",
          hashOwnerB,
        ],
      );
    });

    const menuCategoryId = randomUUID();
    const menuProductId = randomUUID();
    const tableId = randomUUID();
    const httpTableNumber = "Table HTTP test";

    const provisioningPool = adminPool ?? appPool;
    await inTransaction(provisioningPool, async (client) => {
      await setTenant(client, tenantAId, ownerAId);
      await client.query(
        `INSERT INTO public.dining_tables
          ("id", "restaurantId", "tableNumber", "zone", "capacity", "updatedAt")
         VALUES ($1::uuid, $2::uuid, $3, 'STANDARD', 4, now())`,
        [tableId, tenantAId, httpTableNumber],
      );
    });

    await inTransaction(appPool, async (client) => {
      await setTenant(client, tenantAId, ownerAId);
      await client.query(
        `INSERT INTO public.menu_categories ("id", "restaurantId", "name", "updatedAt")
         VALUES ($1::uuid, $2::uuid, 'Catégorie HTTP test', now())`,
        [menuCategoryId, tenantAId],
      );
      await client.query(
        `INSERT INTO public.menu_products
          ("id", "restaurantId", "categoryId", "name", "preparationStation", "currency",
           "standardPriceAmount", "updatedAt")
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'Produit test catalogue',
           'CUISINE'::public.menu_preparation_station, 'CDF', 12500, now())`,
        [menuProductId, tenantAId, menuCategoryId],
      );
    });

    // 3. Créer Manager A
    const emailManagerA = "manager-a@test.invalid";
    const passwordManagerA = "TestPassword123!";
    const hashManagerA = await hashPassword(passwordManagerA);
    const managerAId = randomUUID();
    const tokenManager = randomBytes(32).toString("base64url");
    const tokenHashManager = createHash("sha256")
      .update(tokenManager)
      .digest("hex");
    const invManagerId = randomUUID();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log("Création de Manager A...");
    await inTransaction(appPool, async (client) => {
      await setTenant(client, tenantAId, ownerAId);
      await client.query(
        `SELECT * FROM restoplus_private.create_membership_invitation(
        $1::uuid, $2, 'MANAGER'::public.membership_role, $3, $4::timestamptz
      )`,
        [invManagerId, emailManagerA, tokenHashManager, expiry],
      );
    });

    await inTransaction(authPool, async (client) => {
      await client.query(
        `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
        [tokenHashManager, managerAId, "Manager Test A", hashManagerA],
      );
    });

    // 4. Créer Waiter A
    const emailWaiterA = "waiter-a@test.invalid";
    const passwordWaiterA = "TestPassword123!";
    const hashWaiterA = await hashPassword(passwordWaiterA);
    const waiterAId = randomUUID();
    const tokenWaiter = randomBytes(32).toString("base64url");
    const tokenHashWaiter = createHash("sha256")
      .update(tokenWaiter)
      .digest("hex");
    const invWaiterId = randomUUID();
    const displayNameWaiterA = "Serveur Test A";

    console.log("Création de Waiter A...");
    await inTransaction(appPool, async (client) => {
      await setTenant(client, tenantAId, ownerAId);
      await client.query(
        `SELECT * FROM restoplus_private.create_membership_invitation(
        $1::uuid, $2, 'WAITER'::public.membership_role, $3, $4::timestamptz
      )`,
        [invWaiterId, emailWaiterA, tokenHashWaiter, expiry],
      );
    });

    await inTransaction(authPool, async (client) => {
      await client.query(
        `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
        [tokenHashWaiter, waiterAId, displayNameWaiterA, hashWaiterA],
      );
    });

    console.log(
      "\n==============================================================================",
    );
    console.log(
      "Fixtures créées avec succès ! Copiez-collez ce bloc dans PowerShell :",
    );
    console.log(
      "==============================================================================",
    );
    console.log(
      `$env:RESTOPLUS_HTTP_TEST_CONFIRMATION = "isolated-disposable"`,
    );
    console.log(`$env:RESTOPLUS_HTTP_BASE_URL = "http://localhost:3000"`);
    console.log(
      "Les URL PostgreSQL restent configurées localement; elles ne sont pas imprimées.",
    );
    console.log(`$env:RESTOPLUS_HTTP_OWNER_A_CODE = "${codeA}"`);
    console.log(`$env:RESTOPLUS_HTTP_OWNER_A_EMAIL = "${emailOwnerA}"`);
    console.log(`$env:RESTOPLUS_HTTP_OWNER_A_PASSWORD = "${passwordOwnerA}"`);
    console.log(`$env:RESTOPLUS_HTTP_OWNER_A_USER_ID = "${ownerAId}"`);
    console.log(`$env:RESTOPLUS_HTTP_OWNER_A_RESTAURANT_ID = "${tenantAId}"`);
    console.log(`$env:RESTOPLUS_HTTP_MENU_PRODUCT_ID = "${menuProductId}"`);
    console.log(`$env:RESTOPLUS_HTTP_TABLE_NUMBER = "${httpTableNumber}"`);
    console.log(`$env:RESTOPLUS_HTTP_MANAGER_A_CODE = "${codeA}"`);
    console.log(`$env:RESTOPLUS_HTTP_MANAGER_A_EMAIL = "${emailManagerA}"`);
    console.log(
      `$env:RESTOPLUS_HTTP_MANAGER_A_PASSWORD = "${passwordManagerA}"`,
    );
    console.log(`$env:RESTOPLUS_HTTP_WAITER_A_CODE = "${codeA}"`);
    console.log(`$env:RESTOPLUS_HTTP_WAITER_A_EMAIL = "${emailWaiterA}"`);
    console.log(`$env:RESTOPLUS_HTTP_WAITER_A_PASSWORD = "${passwordWaiterA}"`);
    console.log(`$env:RESTOPLUS_HTTP_WAITER_A_USER_ID = "${waiterAId}"`);
    console.log(
      `$env:RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME = "${displayNameWaiterA}"`,
    );
    console.log(`$env:RESTOPLUS_HTTP_OWNER_B_USER_ID = "${ownerBId}"`);
    console.log(
      `$env:RESTOPLUS_HTTP_TENANT_B_DISPLAY_NAME = "${displayNameB}"`,
    );
    console.log(
      "==============================================================================\n",
    );
  } finally {
    await Promise.allSettled([appPool.end(), authPool.end(), adminPool?.end()]);
  }
}

run().catch((error) => {
  console.error("Erreur lors du seed :", error);
  process.exit(1);
});
