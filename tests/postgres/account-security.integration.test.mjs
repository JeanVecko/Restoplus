import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const appUrl = process.env.RESTOPLUS_TEST_APP_DATABASE_URL;
const authUrl = process.env.RESTOPLUS_TEST_AUTH_DATABASE_URL;
const enabled = Boolean(appUrl && authUrl);
let app;
let auth;
let tenantA;
let tenantB;
let ownerA;
let ownerB;
let waiterA;
let managerA;

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

async function createMemberInvitation(
  restaurantId,
  actorId,
  role,
  accept = true,
) {
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
  if (accept) {
    await auth.query(
      `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
      [tokenHash, userId, "Membre test", "scrypt$synthetic"],
    );
  }
  return { userId, tokenHash };
}

before(async () => {
  if (!enabled) return;
  if (
    process.env.RESTOPLUS_TEST_DATABASE_CONFIRMATION !== "isolated-disposable"
  ) {
    throw new Error(
      "Refusing PostgreSQL tests without RESTOPLUS_TEST_DATABASE_CONFIRMATION=isolated-disposable",
    );
  }
  app = new Pool({ connectionString: appUrl, max: 3 });
  auth = new Pool({ connectionString: authUrl, max: 2 });
  const identity = await app.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(identity.rows[0].role, "restoplus_app");
  assert.match(identity.rows[0].db, /^restoplus_test_[a-z0-9_]+$/i);
  const authIdentity = await auth.query(
    "SELECT current_database() AS db, current_user AS role",
  );
  assert.equal(authIdentity.rows[0].role, "restoplus_auth");
  assert.equal(authIdentity.rows[0].db, identity.rows[0].db);
  tenantA = randomUUID();
  tenantB = randomUUID();
  ownerA = randomUUID();
  ownerB = randomUUID();
  for (const [restaurantId, userId, code] of [
    [tenantA, ownerA, `test-${randomUUID().slice(0, 12)}`],
    [tenantB, ownerB, `test-${randomUUID().slice(0, 12)}`],
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
          "Restaurant synthétique",
          userId,
          "Propriétaire test",
          `${userId}@example.invalid`,
          "scrypt$synthetic",
        ],
      );
    });
  }
  managerA = (await createMemberInvitation(tenantA, ownerA, "MANAGER")).userId;
  waiterA = (await createMemberInvitation(tenantA, ownerA, "WAITER")).userId;
});

after(async () => {
  await app?.end();
  await auth?.end();
});

test(
  "RLS isolates tenants and transaction-local context does not leak through a reused connection",
  { skip: !enabled },
  async () => {
    const client = await app.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenantA,
      ]);
      const ownRows = await client.query("SELECT id FROM public.restaurants");
      assert.deepEqual(
        ownRows.rows.map((row) => row.id),
        [tenantA],
      );
      const crossTenantRows = await client.query(
        "SELECT id FROM public.restaurants WHERE id = $1::uuid",
        [tenantB],
      );
      assert.equal(crossTenantRows.rows.length, 0);
      const crossTenantUpdate = await client.query(
        "UPDATE public.restaurants SET name = $1 WHERE id = $2::uuid",
        ["Tentative croisée", tenantB],
      );
      assert.equal(crossTenantUpdate.rowCount, 0);
      await client.query("COMMIT");
      await client.query("BEGIN");
      await setTenant(client, tenantB, ownerB);
      const otherTenantRows = await client.query(
        "SELECT id FROM public.restaurants",
      );
      assert.deepEqual(
        otherTenantRows.rows.map((row) => row.id),
        [tenantB],
      );
      await client.query("COMMIT");
      await client.query("BEGIN");
      const noContextRows = await client.query(
        "SELECT id FROM public.restaurants",
      );
      assert.equal(noContextRows.rows.length, 0);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    assert.notEqual(tenantA, tenantB);
  },
);

test(
  "restoplus_app cannot directly read credentials or sessions or change sensitive account fields",
  { skip: !enabled },
  async () => {
    const deniedOperations = [
      ['SELECT "passwordHash" FROM public.auth_credentials', []],
      ['SELECT "tokenHash" FROM public.sessions', []],
      [
        'UPDATE public.memberships SET role = \'MANAGER\' WHERE "restaurantId" = $1::uuid AND "userId" = $2::uuid',
        [tenantA, waiterA],
      ],
      [
        'UPDATE public.memberships SET "isActive" = false WHERE "restaurantId" = $1::uuid AND "userId" = $2::uuid',
        [tenantA, waiterA],
      ],
      [
        'UPDATE public.users SET "isActive" = false WHERE "restaurantId" = $1::uuid AND id = $2::uuid',
        [tenantA, waiterA],
      ],
      [
        'UPDATE public.restaurants SET "isActive" = false WHERE id = $1::uuid',
        [tenantA],
      ],
      [
        'DELETE FROM public.memberships WHERE "restaurantId" = $1::uuid AND "userId" = $2::uuid',
        [tenantA, waiterA],
      ],
    ];

    for (const [statement, parameters] of deniedOperations) {
      await assert.rejects(
        inTransaction(app, async (client) => {
          await setTenant(client, tenantA, ownerA);
          await client.query(statement, parameters);
        }),
      );
    }
  },
);

test(
  "MANAGER may change operational roles but cannot promote to OWNER",
  { skip: !enabled },
  async () => {
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, managerA);
      await client.query(
        `SELECT restoplus_private.manage_member($1::uuid, 'KITCHEN'::public.membership_role, NULL, NULL)`,
        [waiterA],
      );
      await assert.rejects(
        client.query(
          `SELECT restoplus_private.manage_member($1::uuid, 'OWNER'::public.membership_role, NULL, NULL)`,
          [waiterA],
        ),
      );
    });
  },
);

test(
  "cross-tenant changes and self-promotion are rejected",
  { skip: !enabled },
  async () => {
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, ownerA);
      await assert.rejects(
        client.query(
          `SELECT restoplus_private.manage_member($1::uuid, 'WAITER'::public.membership_role, false, false)`,
          [ownerB],
        ),
      );
    });
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, managerA);
      await assert.rejects(
        client.query(
          `SELECT restoplus_private.manage_member($1::uuid, 'OWNER'::public.membership_role, NULL, NULL)`,
          [managerA],
        ),
      );
    });
  },
);

test(
  "the last active OWNER cannot be demoted, disabled, or physically changed by direct DML",
  { skip: !enabled },
  async () => {
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, ownerA);
      await assert.rejects(
        client.query(
          `SELECT restoplus_private.manage_member($1::uuid, 'MANAGER'::public.membership_role, NULL, NULL)`,
          [ownerA],
        ),
      );
      await assert.rejects(
        client.query(
          `SELECT restoplus_private.manage_member($1::uuid, NULL, false, NULL)`,
          [ownerA],
        ),
      );
      await assert.rejects(
        client.query(
          `UPDATE public.memberships SET role='OWNER' WHERE "restaurantId"=$1::uuid AND "userId"=$2::uuid`,
          [tenantA, waiterA],
        ),
      );
    });
  },
);

test(
  "invitation acceptance succeeds only once under concurrent attempts",
  { skip: !enabled },
  async () => {
    const pending = await createMemberInvitation(
      tenantA,
      ownerA,
      "CASHIER",
      false,
    );
    const attempts = await Promise.allSettled([
      auth.query(
        `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
        [
          pending.tokenHash,
          pending.userId,
          "Acceptation A",
          "scrypt$synthetic",
        ],
      ),
      auth.query(
        `SELECT * FROM restoplus_private.accept_membership_invitation($1, $2::uuid, $3, $4)`,
        [pending.tokenHash, randomUUID(), "Acceptation B", "scrypt$synthetic"],
      ),
    ]);
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      1,
    );
  },
);

test(
  "OWNER can promote another active member; concurrent demotions preserve one active OWNER",
  { skip: !enabled },
  async () => {
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, ownerA);
      await client.query(
        `SELECT restoplus_private.manage_member($1::uuid, 'OWNER'::public.membership_role, NULL, NULL)`,
        [waiterA],
      );
    });
    const performDemotion = async (actorId, targetId) => {
      const client = await app.connect();
      try {
        await client.query("BEGIN");
        await setTenant(client, tenantA, actorId);
        await client.query(
          `SELECT restoplus_private.manage_member($1::uuid, 'MANAGER'::public.membership_role, NULL, NULL)`,
          [targetId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    };
    const outcomes = await Promise.allSettled([
      performDemotion(ownerA, waiterA),
      performDemotion(waiterA, ownerA),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rows = await inTransaction(app, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenantA,
      ]);
      return client.query(
        `SELECT count(*)::int AS count FROM public.memberships WHERE "restaurantId"=$1::uuid AND role='OWNER' AND "isActive"`,
        [tenantA],
      );
    });
    assert.equal(rows.rows[0].count, 1);
  },
);

test(
  "bootstrap failure rolls back the restaurant inserted earlier in the transaction",
  { skip: !enabled },
  async () => {
    const failedRestaurantId = randomUUID();
    await assert.rejects(
      inTransaction(auth, async (client) => {
        await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
          failedRestaurantId,
        ]);
        await client.query(
          `SELECT * FROM restoplus_private.bootstrap_restaurant_owner(
            $1::uuid, $2, $3, $4::uuid, $5, $6, $7
          )`,
          [
            failedRestaurantId,
            `test-${randomUUID().slice(0, 12)}`,
            "Restaurant test",
            ownerA,
            "Collision",
            `${randomUUID()}@example.invalid`,
            "scrypt$synthetic",
          ],
        );
      }),
    );
    const visible = await inTransaction(auth, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        failedRestaurantId,
      ]);
      return client.query("SELECT id FROM public.restaurants");
    });
    assert.equal(visible.rows.length, 0);
  },
);

test(
  "member deactivation revokes sessions without deleting rows",
  { skip: !enabled },
  async () => {
    const sessionHash = createHash("sha256")
      .update(randomBytes(32))
      .digest("hex");
    const sessionId = randomUUID();
    await inTransaction(auth, async (client) => {
      await setTenant(client, tenantA, managerA);
      await client.query(
        `INSERT INTO public.sessions ("id", "restaurantId", "userId", "tokenHash", "absoluteExpiresAt")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, now() + interval '12 hours')`,
        [sessionId, tenantA, managerA, sessionHash],
      );
    });
    const activeOwners = await inTransaction(app, async (client) => {
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenantA,
      ]);
      return client.query(
        `SELECT m."userId" FROM public.memberships AS m
         JOIN public.users AS u ON u."restaurantId"=m."restaurantId" AND u.id=m."userId"
         WHERE m."restaurantId"=$1::uuid AND m.role='OWNER' AND m."isActive" AND u."isActive"`,
        [tenantA],
      );
    });
    const actorId = activeOwners.rows[0]?.userId;
    assert.ok(actorId);
    await inTransaction(app, async (client) => {
      await setTenant(client, tenantA, actorId);
      await client.query(
        `SELECT restoplus_private.manage_member($1::uuid, NULL, false, false)`,
        [managerA],
      );
    });
    const sessions = await inTransaction(auth, async (client) => {
      await setTenant(client, tenantA, managerA);
      return client.query(
        `SELECT "revokedAt" FROM public.sessions WHERE "id"=$1::uuid`,
        [sessionId],
      );
    });
    assert.ok(sessions.rows[0]?.revokedAt);
  },
);
