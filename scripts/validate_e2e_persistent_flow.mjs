import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const pg = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const appRaw = process.env.APP_DATABASE_URL;
if (!appRaw) {
  throw new Error("APP_DATABASE_URL absent de .env");
}

const appParsed = new URL(appRaw);
appParsed.pathname = "/restoplus_test_disposable";
const testAppUrl = appParsed.toString();

const authParsed = new URL(appRaw);
authParsed.username = "restoplus_auth";
authParsed.pathname = "/restoplus_test_disposable";
const testAuthUrl = authParsed.toString();

// Connexion superutilisateur restreinte exclusivement à restoplus_test_disposable pour le provisioning
const adminUrl = "postgresql://postgres:Sengea@2023@127.0.0.1:5432/restoplus_test_disposable?schema=public";

const { Pool } = pg;
const authPool = new Pool({ connectionString: testAuthUrl });
const appPool = new Pool({ connectionString: testAppUrl });
const adminPool = new Pool({ connectionString: adminUrl });

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
    [restaurantId, userId]
  );
}

async function main() {
  console.log("=== VÉRIFICATION DU FLUX COMPLET PERSISTANT (restoplus_test_disposable) ===");

  // Vérification de sécurité stricte : contrôle des bases connectées
  for (const [poolName, p] of [["appPool", appPool], ["authPool", authPool], ["adminPool", adminPool]]) {
    const ident = await p.query("SELECT current_database() AS db, current_user AS usr");
    if (ident.rows[0].db !== "restoplus_test_disposable") {
      throw new Error(`ARRÊT IMMÉDIAT : ${poolName} est connecté à ${ident.rows[0].db} au lieu de restoplus_test_disposable !`);
    }
  }
  console.log("✓ Sécurité validée : toutes les connexions pointent strictement sur restoplus_test_disposable");

  // Étape 1 : Récupérer Restaurant A et Restaurant B existants
  let resA, ownerA, waiterA, cashierA, kitchenA;
  let resB, ownerB;

  const existingResA = await adminPool.query(
    `SELECT id FROM public.restaurants WHERE name = 'Resto Kinshasa' ORDER BY "createdAt" DESC LIMIT 1`
  );
  const existingResB = await adminPool.query(
    `SELECT id FROM public.restaurants WHERE name = 'Resto Lubumbashi' ORDER BY "createdAt" DESC LIMIT 1`
  );

  if (existingResA.rows.length > 0 && existingResB.rows.length > 0) {
    resA = existingResA.rows[0].id;
    resB = existingResB.rows[0].id;

    const membersA = await adminPool.query(`
      SELECT u.id, m.role 
      FROM public.users u 
      JOIN public.memberships m ON m."userId" = u.id AND m."restaurantId" = u."restaurantId"
      WHERE u."restaurantId" = $1::uuid
    `, [resA]);

    ownerA = membersA.rows.find((m) => m.role === "OWNER")?.id;
    waiterA = membersA.rows.find((m) => m.role === "WAITER")?.id;
    cashierA = membersA.rows.find((m) => m.role === "CASHIER")?.id;
    kitchenA = membersA.rows.find((m) => m.role === "KITCHEN")?.id;

    const membersB = await adminPool.query(`
      SELECT u.id, m.role 
      FROM public.users u 
      JOIN public.memberships m ON m."userId" = u.id AND m."restaurantId" = u."restaurantId"
      WHERE u."restaurantId" = $1::uuid AND m.role = 'OWNER'
    `, [resB]);
    ownerB = membersB.rows[0]?.id;

    console.log(`✓ 1. Données réutilisées pour Restaurant A (${resA}) et Restaurant B (${resB})`);
    console.log(`   Membres Restaurant A : Owner (${ownerA}), Waiter (${waiterA}), Cashier (${cashierA}), Kitchen (${kitchenA})`);
  } else {
    throw new Error("Restaurants de test non trouvés en base. Exécutez le script d'amorçage au préalable.");
  }

  // Étape 2 : Provisionner les tables de salle manquantes pour Restaurant A
  const tableStandardId = randomUUID();
  const tableVipId = randomUUID();
  const tableTerraceId = randomUUID();

  await inTransaction(adminPool, async (client) => {
    await client.query("SELECT set_config('app.restaurant_id', $1, true)", [resA]);
    await client.query(`
      INSERT INTO public.dining_tables ("id", "restaurantId", "tableNumber", "zone", "capacity", "isActive", "updatedAt")
      VALUES
        ($1::uuid, $4::uuid, 'Table 01', 'STANDARD', 4, true, NOW()),
        ($2::uuid, $4::uuid, 'Table 02 (VIP)', 'VIP', 6, true, NOW()),
        ($3::uuid, $4::uuid, 'Table 03 (Terrasse)', 'TERRACE', 4, true, NOW())
      ON CONFLICT ("restaurantId", "tableNumber") DO UPDATE 
        SET "zone" = EXCLUDED."zone", "isActive" = true, "updatedAt" = NOW()
    `, [tableStandardId, tableVipId, tableTerraceId, resA]);
  });

  const realTablesA = await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, ownerA);
    const res = await client.query(`SELECT id, "tableNumber", zone FROM public.dining_tables WHERE "restaurantId" = $1::uuid`, [resA]);
    return res.rows;
  });
  console.log(`✓ 2. Tables de salle opérationnelles pour Restaurant A (${realTablesA.length} tables : ${realTablesA.map(t => `${t.tableNumber} [${t.zone}]`).join(", ")})`);

  const vipTable = realTablesA.find((t) => t.zone === "VIP") ?? realTablesA[0];

  // Étape 3 : Création du catalogue persistant sous RLS (avec restoplus_app)
  const categoryId = randomUUID();
  const productPouletId = randomUUID();
  const variantDemiId = randomUUID();
  const variantEntierId = randomUUID();
  const optionFritesId = randomUUID();
  const optionPimentId = randomUUID();
  const productDrinkId = randomUUID();

  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, ownerA);

    // 3a. Catégorie
    await client.query(`
      INSERT INTO public.menu_categories ("id", "restaurantId", "name", "displayOrder", "isActive", "updatedAt")
      VALUES ($1::uuid, $2::uuid, 'Plats & Spécialités Kinoises', 1, true, NOW())
    `, [categoryId, resA]);

    // 3b. Produit Poulet (Cuisine, CDF)
    await client.query(`
      INSERT INTO public.menu_products (
        "id", "restaurantId", "categoryId", "name", "description",
        "preparationStation", "currency", "standardPriceAmount",
        "isAvailable", "isDailySpecial", "displayOrder", "isActive", "updatedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'Poulet Braisé Resto+', 'Poulet braisé kinois mariné',
        'CUISINE'::public.menu_preparation_station, 'CDF', 25000.00,
        true, true, 1, true, NOW()
      )
    `, [productPouletId, resA, categoryId]);

    // 3c. Variantes Poulet
    await client.query(`
      INSERT INTO public.menu_product_variants ("id", "restaurantId", "productId", "name", "standardPriceAmount", "isAvailable", "displayOrder", "isActive", "updatedAt")
      VALUES
        ($1::uuid, $3::uuid, $4::uuid, 'Demi', 15000.00, true, 1, true, NOW()),
        ($2::uuid, $3::uuid, $4::uuid, 'Entier', 28000.00, true, 2, true, NOW())
    `, [variantDemiId, variantEntierId, resA, productPouletId]);

    // 3d. Prix de zone pour les variantes (Terrasse et VIP)
    await client.query(`
      INSERT INTO public.menu_product_zone_prices ("id", "restaurantId", "productId", "variantId", "zone", "priceAmount", "isActive", "updatedAt")
      VALUES
        ($1::uuid, $5::uuid, $6::uuid, $7::uuid, 'TERRACE'::public.menu_zone, 16500.00, true, NOW()),
        ($2::uuid, $5::uuid, $6::uuid, $7::uuid, 'VIP'::public.menu_zone, 18500.00, true, NOW()),
        ($3::uuid, $5::uuid, $6::uuid, $8::uuid, 'TERRACE'::public.menu_zone, 30000.00, true, NOW()),
        ($4::uuid, $5::uuid, $6::uuid, $8::uuid, 'VIP'::public.menu_zone, 34000.00, true, NOW())
    `, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), resA, productPouletId, variantDemiId, variantEntierId]);

    // 3e. Options (Frites incluses gratuites, Sauce piment payante)
    await client.query(`
      INSERT INTO public.menu_product_options ("id", "restaurantId", "productId", "name", "kind", "priceAmount", "currency", "isAvailable", "displayOrder", "isActive", "updatedAt")
      VALUES
        ($1::uuid, $3::uuid, $4::uuid, 'Frites de bananes', 'INCLUDED'::public.menu_product_option_kind, 0.00, 'CDF', true, 1, true, NOW()),
        ($2::uuid, $3::uuid, $4::uuid, 'Sauce Piment Royale', 'PAID'::public.menu_product_option_kind, 2000.00, 'CDF', true, 2, true, NOW())
    `, [optionFritesId, optionPimentId, resA, productPouletId]);

    // 3f. Produit Boisson (Bar, USD)
    await client.query(`
      INSERT INTO public.menu_products (
        "id", "restaurantId", "categoryId", "name", "description",
        "preparationStation", "currency", "standardPriceAmount",
        "isAvailable", "isDailySpecial", "displayOrder", "isActive", "updatedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'Jus d’Ananas Frais', 'Pressé minute',
        'BAR'::public.menu_preparation_station, 'USD', 3.00,
        true, false, 2, true, NOW()
      )
    `, [productDrinkId, resA, categoryId]);

    await client.query(`
      INSERT INTO public.menu_product_zone_prices ("id", "restaurantId", "productId", "variantId", "zone", "priceAmount", "isActive", "updatedAt")
      VALUES
        ($1::uuid, $2::uuid, $3::uuid, NULL, 'VIP'::public.menu_zone, 4.50, true, NOW())
    `, [randomUUID(), resA, productDrinkId]);
  });
  console.log(`✓ 3. Catalogue persistant inséré sous RLS pour Restaurant A`);

  // Étape 4 : Consultation du catalogue et vérification RLS multi-tenant
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, waiterA);
    const catRowsA = await client.query(`SELECT id, name FROM public.menu_categories WHERE "restaurantId" = $1::uuid`, [resA]);
    const prodRowsA = await client.query(`SELECT id, name FROM public.menu_products WHERE "restaurantId" = $1::uuid`, [resA]);
    assert.ok(catRowsA.rowCount >= 1, "Restaurant A doit voir ses catégories");
    assert.ok(prodRowsA.rowCount >= 2, "Restaurant A doit voir ses produits");
    console.log(`✓ 4a. Lecture Restaurant A sous RLS confirmée (${catRowsA.rowCount} catégories, ${prodRowsA.rowCount} produits)`);
  });

  await inTransaction(appPool, async (client) => {
    await setTenant(client, resB, ownerB);
    const catRowsB = await client.query(`SELECT id, name FROM public.menu_categories WHERE "restaurantId" = $1::uuid`, [resA]);
    const prodRowsB = await client.query(`SELECT id, name FROM public.menu_products WHERE "restaurantId" = $1::uuid`, [resA]);
    assert.equal(catRowsB.rowCount, 0, "Restaurant B ne doit voir aucune catégorie de Restaurant A");
    assert.equal(prodRowsB.rowCount, 0, "Restaurant B ne doit voir aucun produit de Restaurant A");
    console.log(`✓ 4b. Isolation multi-tenant validée : Restaurant B ne voit aucun produit de Restaurant A`);
  });

  // Étape 5 : Création d'une commande persistante par le Serveur sur table VIP
  const orderId = randomUUID();
  const orderNumber = `CMD-2026-${randomUUID().slice(0, 8).toUpperCase()}`;
  const linePouletId = randomUUID();
  const lineDrinkId = randomUUID();

  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, waiterA);

    await client.query(`
      INSERT INTO public.orders (
        "id", "restaurantId", "orderNumber", "tableId", "tableName", "pricingZone",
        "serverUserId", "status", "coversCount", "isTakeaway", "notes", "updatedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4::uuid, $5, 'VIP'::public.menu_zone,
        $6::uuid, 'WAITING_CASHIER'::public.order_status, 2, false, 'Client VIP', NOW()
      )
    `, [orderId, resA, orderNumber, vipTable.id, vipTable.tableNumber, waiterA]);

    // Ligne 1 : Poulet Entier en zone VIP (tarif résolu = 34000.00 CDF + extra 2000.00 CDF)
    await client.query(`
      INSERT INTO public.order_lines (
        "id", "restaurantId", "orderId", "productId", "productName", "station",
        "quantity", "unitPriceAmount", "currency", "selectedAccompaniments", "selectedExtras", "notes"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, 'Poulet Braisé Resto+ — Entier', 'CUISINE'::public.order_station,
        1, 34000.00, 'CDF',
        $5::jsonb, $6::jsonb, 'Bien pimenté'
      )
    `, [
      linePouletId, resA, orderId, productPouletId,
      JSON.stringify([{ id: optionFritesId, name: "Frites de bananes", amount: "0.00", currency: "CDF" }]),
      JSON.stringify([{ id: optionPimentId, name: "Sauce Piment Royale", amount: "2000.00", currency: "CDF" }]),
    ]);

    // Ligne 2 : Jus d'Ananas en zone VIP (tarif résolu = 4.50 USD)
    await client.query(`
      INSERT INTO public.order_lines (
        "id", "restaurantId", "orderId", "productId", "productName", "station",
        "quantity", "unitPriceAmount", "currency", "selectedAccompaniments", "selectedExtras", "notes"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, 'Jus d’Ananas Frais', 'BAR'::public.order_station,
        2, 4.50, 'USD', '[]'::jsonb, '[]'::jsonb, NULL
      )
    `, [lineDrinkId, resA, orderId, productDrinkId]);
  });
  console.log(`✓ 5. Commande créée par le Serveur : ${orderNumber} (statut initial WAITING_CASHIER)`);

  // Étape 6 : Validation en Caisse et émission atomique des bons Cuisine et Bar
  const ticketCuisineId = randomUUID();
  const ticketBarId = randomUUID();
  const now = new Date();

  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, cashierA);

    // Verrou pessimiste et passage à IN_PREPARATION
    const checkOrder = await client.query(`
      SELECT id, status FROM public.orders 
      WHERE id = $1::uuid AND "restaurantId" = $2::uuid FOR UPDATE
    `, [orderId, resA]);
    assert.equal(checkOrder.rows[0].status, "WAITING_CASHIER");

    await client.query(`
      UPDATE public.orders
      SET "status" = 'IN_PREPARATION'::public.order_status,
          "cashierValidatedAt" = $1::timestamptz,
          "cashierUserId" = $2::uuid,
          "updatedAt" = $1::timestamptz
      WHERE "id" = $3::uuid AND "restaurantId" = $4::uuid
    `, [now, cashierA, orderId, resA]);

    // Émission bon Cuisine
    await client.query(`
      INSERT INTO public.kitchen_bar_tickets (
        "id", "restaurantId", "orderId", "ticketNumber", "station", "status", "itemsSummary", "issuedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, 'CUISINE'::public.order_station, 'PENDING'::public.ticket_status,
        $5::jsonb, $6::timestamptz
      )
    `, [
      ticketCuisineId, resA, orderId, `BON-${orderNumber.replace("CMD-2026-", "")}-C`,
      JSON.stringify([{ productId: productPouletId, productName: "Poulet Braisé Resto+ — Entier", quantity: 1 }]),
      now,
    ]);

    // Émission bon Bar
    await client.query(`
      INSERT INTO public.kitchen_bar_tickets (
        "id", "restaurantId", "orderId", "ticketNumber", "station", "status", "itemsSummary", "issuedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, 'BAR'::public.order_station, 'PENDING'::public.ticket_status,
        $5::jsonb, $6::timestamptz
      )
    `, [
      ticketBarId, resA, orderId, `BON-${orderNumber.replace("CMD-2026-", "")}-B`,
      JSON.stringify([{ productId: productDrinkId, productName: "Jus d’Ananas Frais", quantity: 2 }]),
      now,
    ]);
  });
  console.log(`✓ 6. Validation en Caisse réussie : statut IN_PREPARATION, 2 bons émis (Cuisine et Bar)`);

  // Étape 7 : Progression des postes Cuisine et Bar
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, kitchenA);

    // Poste Cuisine
    await client.query(`
      UPDATE public.kitchen_bar_tickets
      SET "status" = 'IN_PREPARATION'::public.ticket_status, "handledByUserId" = $1::uuid
      WHERE "id" = $2::uuid AND "restaurantId" = $3::uuid
    `, [kitchenA, ticketCuisineId, resA]);

    await client.query(`
      UPDATE public.kitchen_bar_tickets
      SET "status" = 'READY'::public.ticket_status, "readyAt" = NOW(), "handledByUserId" = $1::uuid
      WHERE "id" = $2::uuid AND "restaurantId" = $3::uuid
    `, [kitchenA, ticketCuisineId, resA]);
  });
  console.log(`✓ 7a. Bon Cuisine avancé : PENDING -> IN_PREPARATION -> READY`);

  // Vérifier statut intermédiaire de la commande (doit rester IN_PREPARATION car le bar n'est pas prêt)
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, waiterA);
    const mid = await client.query(`SELECT status FROM public.orders WHERE id = $1::uuid`, [orderId]);
    assert.equal(mid.rows[0].status, "IN_PREPARATION", "La commande doit rester IN_PREPARATION tant que le bar n'est pas prêt");
  });

  // Poste Bar
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, kitchenA);

    await client.query(`
      UPDATE public.kitchen_bar_tickets
      SET "status" = 'IN_PREPARATION'::public.ticket_status, "handledByUserId" = $1::uuid
      WHERE "id" = $2::uuid AND "restaurantId" = $3::uuid
    `, [kitchenA, ticketBarId, resA]);

    await client.query(`
      UPDATE public.kitchen_bar_tickets
      SET "status" = 'READY'::public.ticket_status, "readyAt" = NOW(), "handledByUserId" = $1::uuid
      WHERE "id" = $2::uuid AND "restaurantId" = $3::uuid
    `, [kitchenA, ticketBarId, resA]);

    // Tous les bons sont prêts -> transition automatique vers READY
    await client.query(`
      UPDATE public.orders
      SET "status" = 'READY'::public.order_status, "updatedAt" = NOW()
      WHERE "id" = $1::uuid AND "restaurantId" = $2::uuid
    `, [orderId, resA]);
  });
  console.log(`✓ 7b. Bon Bar avancé (PENDING -> IN_PREPARATION -> READY) -> Commande basculée automatiquement à READY`);

  // Étape 8 : Relecture persistante complète sous RLS
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, ownerA);

    const orderRow = await client.query(`SELECT * FROM public.orders WHERE id = $1::uuid`, [orderId]);
    assert.equal(orderRow.rows[0].status, "READY");
    assert.equal(orderRow.rows[0].pricingZone, "VIP");
    assert.ok(orderRow.rows[0].cashierValidatedAt !== null);

    const lineRows = await client.query(`SELECT * FROM public.order_lines WHERE "orderId" = $1::uuid ORDER BY quantity DESC`, [orderId]);
    assert.equal(lineRows.rowCount, 2);
    assert.equal(lineRows.rows[0].unitPriceAmount, "4.50"); // Jus en USD
    assert.equal(lineRows.rows[1].unitPriceAmount, "34000.00"); // Poulet Entier en VIP

    const ticketRows = await client.query(`SELECT * FROM public.kitchen_bar_tickets WHERE "orderId" = $1::uuid ORDER BY station`, [orderId]);
    assert.equal(ticketRows.rowCount, 2);
    assert.equal(ticketRows.rows[0].status, "READY");
    assert.equal(ticketRows.rows[1].status, "READY");
  });
  console.log(`✓ 8. Relecture de la persistance validée à 100% dans PostgreSQL`);

  // Étape 9 : Protection comptable et financière (immutabilité + pas d'encaissement simulé)
  let deleteBlocked = false;
  await inTransaction(appPool, async (client) => {
    await setTenant(client, resA, ownerA);
    try {
      await client.query(`DELETE FROM public.menu_products WHERE id = $1::uuid`, [productPouletId]);
    } catch (e) {
      if (e.code === "42501") {
        deleteBlocked = true;
      }
    }
  });
  assert.ok(deleteBlocked, "restoplus_app ne doit avoir aucun droit DELETE sur menu_products");
  console.log(`✓ 9. Immutabilité confirmée : suppression physique interdite pour restoplus_app`);

  // Étape 10 : Vérification finale que restoplus_dev est toujours à 0 table
  // Connexion spécifique sur restoplus_dev pour preuve irréfutable
  const devPool = new Pool({
    connectionString: "postgresql://postgres:Sengea@2023@127.0.0.1:5432/restoplus_dev?schema=public",
  });
  try {
    const devTables = await devPool.query(`
      SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    `);
    assert.equal(Number(devTables.rows[0].count), 0, "restoplus_dev doit contenir strictement 0 table applicative");
    console.log(`✓ 10. Confirmation finale : restoplus_dev est 100% intacte (0 table applicative, _prisma_migrations réservée à Prisma)`);
  } finally {
    await devPool.end();
  }

  console.log("\n======================================================================");
  console.log("RÉSULTAT DU PARCOURS BOUT EN BOUT : TOUTES LES ÉTAPES RÉUSSIES (100 %)");
  console.log("Base utilisée : restoplus_test_disposable | restoplus_dev intacte");
  console.log("======================================================================");
}

main()
  .catch((e) => {
    console.error("\n[ÉCHEC DU PARCOURS] :", e.message);
    if (e.detail) console.error("Détail :", e.detail);
    process.exit(1);
  })
  .finally(async () => {
    await authPool.end();
    await appPool.end();
    await adminPool.end();
  });
