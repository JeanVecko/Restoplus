// ==============================================================================
// Resto+ — Tests d'intégration PostgreSQL pour le cycle des Commandes
// Cible : restoplus_test_disposable uniquement.
// Ne s'exécute JAMAIS sur restoplus_dev
// ==============================================================================

import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";
import {
  canCancelOrder,
  canCreateOrder,
  canProcessPayment,
  canUpdateTicketStatus,
  canValidateOrderAtCashier,
} from "../../src/server/orders/authorization.ts";

const { Pool } = pg;
const appUrl = process.env.RESTOPLUS_TEST_APP_DATABASE_URL;
const authUrl = process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL;
const enabled = Boolean(appUrl && authUrl);

let app;
let auth;
let tenantA;
let tenantB;
let ownerA;
let managerA;
let cashierA;
let waiterA;
let kitchenA;
let ownerB;
let orderFixtureId;
let ticketFixtureId;
let catalogCategoryId;
let catalogProductId;

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

async function createMember(restaurantId, actorId, role) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const userId = randomUUID();
  const email = `${userId}@example.invalid`;
  const invitationId = randomUUID();
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await inTransaction(app, async (client) => {
    await setTenant(client, restaurantId, actorId);
    await client.query(
      `SELECT * FROM restoplus_private.create_membership_invitation(
        $1::uuid, $2, $3::public.membership_role, $4, $5::timestamptz
      )`,
      [invitationId, email, role, tokenHash, expiry],
    );
  });

  await auth.query(
    `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
    [tokenHash, userId, `Membre ${role}`, "scrypt$synthetic"],
  );

  return userId;
}

before(async () => {
  if (!enabled) return;

  if (
    process.env.RESTOPLUS_TEST_DATABASE_CONFIRMATION !== "isolated-disposable"
  ) {
    throw new Error(
      "Refus d'exécution : RESTOPLUS_TEST_DATABASE_CONFIRMATION='isolated-disposable' requis.",
    );
  }

  app = new Pool({ connectionString: appUrl, max: 3 });
  auth = new Pool({ connectionString: authUrl, max: 2 });

  const identity = await app.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(identity.rows[0].role, "restoplus_app");
  assert.equal(
    identity.rows[0].db,
    "restoplus_test_disposable",
    "La cible autorisée pour ces tests est restoplus_test_disposable uniquement.",
  );
  const authIdentity = await auth.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(authIdentity.rows[0].role, "restoplus_auth");
  assert.equal(authIdentity.rows[0].db, "restoplus_test_disposable");

  const catalogTables = await app.query(
    `SELECT c.relname FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [["menu_categories", "menu_products", "menu_product_variants", "menu_product_options", "menu_product_zone_prices"]],
  );
  assert.equal(catalogTables.rowCount, 5, "La migration catalogue doit être appliquée à la base jetable avant ces tests.");

  tenantA = randomUUID();
  tenantB = randomUUID();
  ownerA = randomUUID();
  ownerB = randomUUID();

  // Initialisation Restaurant A et B
  for (const [restaurantId, userId, code] of [
    [tenantA, ownerA, `orders-a-${randomUUID().slice(0, 8)}`],
    [tenantB, ownerB, `orders-b-${randomUUID().slice(0, 8)}`],
  ]) {
    await inTransaction(auth, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        restaurantId,
      ]);
      await client.query(
        `SELECT * FROM restoplus_private.bootstrap_restaurant_owner(
          $1::uuid, $2, $3, $4::uuid, $5, $6, $7
        )`,
        [
          restaurantId,
          code,
          "Restaurant Test Commandes",
          userId,
          "Propriétaire",
          `${userId}@test.invalid`,
          "scrypt$synthetic",
        ],
      );
    });
  }

  // Création des membres opérationnels du Restaurant A
  managerA = await createMember(tenantA, ownerA, "MANAGER");
  cashierA = await createMember(tenantA, ownerA, "CASHIER");
  waiterA = await createMember(tenantA, ownerA, "WAITER");
  kitchenA = await createMember(tenantA, ownerA, "KITCHEN");

  orderFixtureId = randomUUID();
  ticketFixtureId = randomUUID();
  catalogCategoryId = randomUUID();
  catalogProductId = randomUUID();
  const now = new Date();
  await inTransaction(app, async (client) => {
    await setTenant(client, tenantA, waiterA);
    await client.query(
      `INSERT INTO public.menu_categories ("id", "restaurantId", "name", "updatedAt")
       VALUES ($1::uuid, $2::uuid, 'Catégorie de test', $3::timestamptz)`,
      [catalogCategoryId, tenantA, now],
    );
    await client.query(
      `INSERT INTO public.menu_products
        ("id", "restaurantId", "categoryId", "name", "preparationStation", "currency",
         "standardPriceAmount", "updatedAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'Produit de test',
         'CUISINE'::public.menu_preparation_station, 'CDF', 10000, $4::timestamptz)`,
      [catalogProductId, tenantA, catalogCategoryId, now],
    );
    await client.query(
      `INSERT INTO public.menu_product_zone_prices
        ("id", "restaurantId", "productId", "zone", "priceAmount", "updatedAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'TERRACE'::public.menu_zone, 12500, $4::timestamptz)`,
      [randomUUID(), tenantA, catalogProductId, now],
    );
    await client.query(
      `INSERT INTO public.menu_product_variants
        ("id", "restaurantId", "productId", "name", "standardPriceAmount", "updatedAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'Grand format', 14000, $4::timestamptz)`,
      [randomUUID(), tenantA, catalogProductId, now],
    );
    await client.query(
      `INSERT INTO public.orders (
        "id", "restaurantId", "orderNumber", "tableName", "serverUserId",
        "status", "coversCount", "createdAt", "updatedAt"
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid,
        'WAITING_CASHIER'::public.order_status, 1, $6::timestamptz, $6::timestamptz)`,
      [
        orderFixtureId,
        tenantA,
        `TEST-${orderFixtureId.slice(0, 8)}`,
        "Table test",
        waiterA,
        now,
      ],
    );
    await client.query(
      `INSERT INTO public.kitchen_bar_tickets (
        "id", "restaurantId", "orderId", "ticketNumber", "station", "status", "issuedAt"
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'CUISINE'::public.order_station,
        'PENDING'::public.ticket_status, $5::timestamptz)`,
      [
        ticketFixtureId,
        tenantA,
        orderFixtureId,
        `TICKET-${ticketFixtureId.slice(0, 8)}`,
        now,
      ],
    );
  });
});

after(async () => {
  await app?.end();
  await auth?.end();
});

test(
  "Server permissions correctly gate order lifecycle transitions",
  { skip: !enabled },
  async () => {
    assert.ok(managerA && cashierA && kitchenA && waiterA);

    // 1. Prise de commande autorisée pour WAITER
    assert.equal(canCreateOrder("WAITER"), true);

    // 2. Validation caisse interdite pour WAITER, autorisée pour CASHIER
    assert.equal(canValidateOrderAtCashier("WAITER"), false);
    assert.equal(canValidateOrderAtCashier("CASHIER"), true);

    // 3. Mise à jour de bon autorisée pour KITCHEN, interdite pour WAITER
    assert.equal(canUpdateTicketStatus("KITCHEN"), true);
    assert.equal(canUpdateTicketStatus("WAITER"), false);

    // 4. Encaissement autorisé pour CASHIER, interdit pour WAITER
    assert.equal(canProcessPayment("CASHIER"), true);
    assert.equal(canProcessPayment("WAITER"), false);

    // 5. Annulation strictement réservée à MANAGER et OWNER
    assert.equal(canCancelOrder("WAITER"), false);
    assert.equal(canCancelOrder("CASHIER"), false);
    assert.equal(canCancelOrder("KITCHEN"), false);
    assert.equal(canCancelOrder("MANAGER"), true);
    assert.equal(canCancelOrder("OWNER"), true);
  },
);

test(
  "RLS hides tenant A orders and catalog without context and from tenant B; app cannot delete or skip lifecycle states",
  { skip: !enabled },
  async () => {
    const withoutContext = await app.query(
      'SELECT "id" FROM public.orders WHERE "id" = $1::uuid',
      [orderFixtureId],
    );
    assert.equal(withoutContext.rowCount, 0);

    const tenantARead = await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, waiterA);
      return client.query(
        'SELECT "id" FROM public.orders WHERE "id" = $1::uuid',
        [orderFixtureId],
      );
    });
    assert.equal(tenantARead.rowCount, 1);

    const tenantBRead = await inTransaction(app, async (client) => {
      await setTenant(client, tenantB, ownerB);
      return client.query(
        'SELECT "id" FROM public.orders WHERE "id" = $1::uuid',
        [orderFixtureId],
      );
    });
    assert.equal(tenantBRead.rowCount, 0);

    const catalogWithoutContext = await app.query(
      'SELECT "id" FROM public.menu_products WHERE "id" = $1::uuid',
      [catalogProductId],
    );
    assert.equal(catalogWithoutContext.rowCount, 0);
    const catalogTenantA = await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, waiterA);
      return client.query(
        'SELECT "id" FROM public.menu_products WHERE "id" = $1::uuid',
        [catalogProductId],
      );
    });
    assert.equal(catalogTenantA.rowCount, 1);
    const catalogTenantB = await inTransaction(app, async (client) => {
      await setTenant(client, tenantB, ownerB);
      return client.query(
        'SELECT "id" FROM public.menu_products WHERE "id" = $1::uuid',
        [catalogProductId],
      );
    });
    assert.equal(catalogTenantB.rowCount, 0);

    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query('DELETE FROM public.orders WHERE "id" = $1::uuid', [
          orderFixtureId,
        ]);
      }),
      (error) => error.code === "42501",
    );

    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query(
          `UPDATE public.orders SET "status" = 'READY'::public.order_status
           WHERE "id" = $1::uuid`,
          [orderFixtureId],
        );
      }),
      (error) => error.code === "23514",
    );

    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, kitchenA);
        await client.query(
          `UPDATE public.kitchen_bar_tickets SET "status" = 'READY'::public.ticket_status
           WHERE "id" = $1::uuid`,
          [ticketFixtureId],
        );
      }),
      (error) => error.code === "23514",
    );
  },
);

test(
  "catalog composite references and constraints isolate restaurants and forbid physical deletion",
  { skip: !enabled },
  async () => {
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantB, ownerB);
        await client.query(
          `INSERT INTO public.menu_products
            ("id", "restaurantId", "categoryId", "name", "preparationStation", "currency",
             "standardPriceAmount", "updatedAt")
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'Référence croisée',
             'CUISINE'::public.menu_preparation_station, 'CDF', 1000, now())`,
          [randomUUID(), tenantB, catalogCategoryId],
        );
      }),
      (error) => error.code === "23503",
    );

    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query(
          'DELETE FROM public.menu_products WHERE "id" = $1::uuid',
          [catalogProductId],
        );
      }),
      (error) => error.code === "42501",
    );

    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, managerA);
      await client.query(
        'UPDATE public.menu_products SET "isActive" = false, "isAvailable" = false WHERE "id" = $1::uuid',
        [catalogProductId],
      );
    });
    const retained = await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, managerA);
      return client.query(
        'SELECT "isActive" FROM public.menu_products WHERE "id" = $1::uuid',
        [catalogProductId],
      );
    });
    assert.equal(retained.rowCount, 1);
    assert.equal(retained.rows[0].isActive, false);
  },
);

test(
  "catalog zone tariff uniqueness and transaction-local tenant context survive pool reuse",
  { skip: !enabled },
  async () => {
    const client = await app.connect();
    try {
      await client.query("BEGIN");
      await setTenant(client, tenantA, managerA);
      const visible = await client.query(
        'SELECT "id" FROM public.menu_products WHERE "id" = $1::uuid',
        [catalogProductId],
      );
      assert.equal(visible.rowCount, 1);
      await client.query("COMMIT");

      const afterCommit = await client.query(
        'SELECT "id" FROM public.menu_products WHERE "id" = $1::uuid',
        [catalogProductId],
      );
      assert.equal(afterCommit.rowCount, 0, "Le contexte local doit disparaître après COMMIT sur la même connexion.");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }

    await assert.rejects(
      inTransaction(app, async (transaction) => {
        await setTenant(transaction, tenantA, managerA);
        await transaction.query(
          `INSERT INTO public.menu_product_zone_prices
            ("id", "restaurantId", "productId", "zone", "priceAmount", "updatedAt")
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'TERRACE'::public.menu_zone, 13000, now())`,
          [randomUUID(), tenantA, catalogProductId],
        );
      }),
      (error) => error.code === "23505",
    );
  },
);

test(
  "Database constraints enforce currency integrity (CDF/USD), positive quantities and valid prices on order lines",
  { skip: !enabled },
  async () => {
    // 1. Devise invalide rejetée par contrainte CHECK
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query(
          `INSERT INTO public.order_lines (
            "id", "restaurantId", "orderId", "productId", "productName",
            "station", "quantity", "unitPriceAmount", "currency"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'p1', 'Produit Test',
            'CUISINE'::public.order_station, 1, 1000, 'EUR')`,
          [randomUUID(), tenantA, orderFixtureId],
        );
      }),
      (error) => error.code === "23514",
      "La devise 'EUR' doit être rejetée (seuls CDF et USD sont autorisés)",
    );

    // 2. Quantité nulle ou hors limite 1..99 rejetée
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query(
          `INSERT INTO public.order_lines (
            "id", "restaurantId", "orderId", "productId", "productName",
            "station", "quantity", "unitPriceAmount", "currency"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'p1', 'Produit Test',
            'CUISINE'::public.order_station, 0, 1000, 'CDF')`,
          [randomUUID(), tenantA, orderFixtureId],
        );
      }),
      (error) => error.code === "23514",
      "Une quantité de 0 doit être rejetée",
    );

    // 3. Prix unitaire négatif rejeté
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query(
          `INSERT INTO public.order_lines (
            "id", "restaurantId", "orderId", "productId", "productName",
            "station", "quantity", "unitPriceAmount", "currency"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'p1', 'Produit Test',
            'CUISINE'::public.order_station, 1, -500, 'CDF')`,
          [randomUUID(), tenantA, orderFixtureId],
        );
      }),
      (error) => error.code === "23514",
      "Un prix négatif doit être rejeté",
    );
  },
);

test(
  "Database constraints enforce mandatory Mobile Money reference numbers and positive payment amounts",
  { skip: !enabled },
  async () => {
    const receiptId = randomUUID();
    const now = new Date();

    // Création d'un reçu test
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, cashierA);
      await client.query(
        `INSERT INTO public.receipts (
          "id", "restaurantId", "orderId", "receiptNumber", "cashierUserId", "createdAt"
        ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::timestamptz)`,
        [receiptId, tenantA, orderFixtureId, `REC-${receiptId.slice(0, 8)}`, cashierA, now],
      );
    });

    // 1. Mobile Money sans référence rejeté
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query(
          `INSERT INTO public.payments (
            "id", "restaurantId", "receiptId", "paymentMethod", "amountPaid",
            "currencyPaid", "referenceNumber", "cashierUserId", "createdAt"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'MPESA'::public.payment_method,
            10, 'USD', NULL, $4::uuid, $5::timestamptz)`,
          [randomUUID(), tenantA, receiptId, cashierA, now],
        );
      }),
      (error) => error.code === "23514",
      "Un paiement Mobile Money sans référence doit violer la contrainte CHECK",
    );

    // 2. Mobile Money avec chaîne vide ou espaces uniquement rejeté
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query(
          `INSERT INTO public.payments (
            "id", "restaurantId", "receiptId", "paymentMethod", "amountPaid",
            "currencyPaid", "referenceNumber", "cashierUserId", "createdAt"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'ORANGE_MONEY'::public.payment_method,
            5000, 'CDF', '   ', $4::uuid, $5::timestamptz)`,
          [randomUUID(), tenantA, receiptId, cashierA, now],
        );
      }),
      (error) => error.code === "23514",
      "Une référence Mobile Money vide doit être rejetée",
    );

    // 3. Montant négatif ou nul rejeté
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query(
          `INSERT INTO public.payments (
            "id", "restaurantId", "receiptId", "paymentMethod", "amountPaid",
            "currencyPaid", "referenceNumber", "cashierUserId", "createdAt"
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'CASH_USD'::public.payment_method,
            0, 'USD', NULL, $4::uuid, $5::timestamptz)`,
          [randomUUID(), tenantA, receiptId, cashierA, now],
        );
      }),
      (error) => error.code === "23514",
      "Un montant de paiement <= 0 doit être rejeté",
    );
  },
);

test(
  "Accounting immutability: restoplus_app cannot DELETE order lines, tickets, receipts, payments, or audit events",
  { skip: !enabled },
  async () => {
    // Tentative de DELETE sur order_lines -> permission denied (42501)
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, waiterA);
        await client.query('DELETE FROM public.order_lines WHERE "restaurantId" = $1::uuid', [tenantA]);
      }),
      (error) => error.code === "42501",
    );

    // Tentative de DELETE sur kitchen_bar_tickets -> permission denied (42501)
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, kitchenA);
        await client.query('DELETE FROM public.kitchen_bar_tickets WHERE "restaurantId" = $1::uuid', [tenantA]);
      }),
      (error) => error.code === "42501",
    );

    // Tentative de DELETE sur receipts -> permission denied (42501)
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query('DELETE FROM public.receipts WHERE "restaurantId" = $1::uuid', [tenantA]);
      }),
      (error) => error.code === "42501",
    );

    // Tentative de DELETE sur payments -> permission denied (42501)
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, cashierA);
        await client.query('DELETE FROM public.payments WHERE "restaurantId" = $1::uuid', [tenantA]);
      }),
      (error) => error.code === "42501",
    );

    // Tentative de DELETE sur order_audit_events -> permission denied (42501)
    await assert.rejects(
      inTransaction(app, async (client) => {
        await setTenant(client, tenantA, ownerA);
        await client.query('DELETE FROM public.order_audit_events WHERE "restaurantId" = $1::uuid', [tenantA]);
      }),
      (error) => error.code === "42501",
    );
  },
);
