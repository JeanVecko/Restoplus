import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration1 = await readFile(
  new URL(
    "../../prisma/migrations/20261019000000_initial_technical_isolation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration2 = await readFile(
  new URL(
    "../../prisma/migrations/20261021000000_orders_and_cashier/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration3 = await readFile(
  new URL(
    "../../prisma/migrations/20261021100000_persistent_menu_catalog/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration = `${migration1}\n${migration2}\n${migration3}`;

test("every Prisma model maps to a migration table with matching scalar columns", () => {
  const models = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
  assert.equal(models.length, 19);
  const scalarTypes = new Set([
    "String",
    "Boolean",
    "DateTime",
    "MembershipRole",
    "MembershipInvitationStatus",
    "OrderStatus",
    "OrderStation",
    "TicketStatus",
    "PaymentMethod",
    "MenuPreparationStation",
    "MenuZone",
    "MenuProductOptionKind",
    "Int",
    "Decimal",
    "Json",
  ]);
  for (const [, modelName, body] of models) {
    const mapped = body.match(/@@map\("([^"]+)"\)/)?.[1];
    assert.ok(mapped, `${modelName} must map to a SQL table`);
    const table = migration.match(
      new RegExp(`CREATE TABLE "public"\\."${mapped}" \\(([\\s\\S]*?)\\n\\);`),
    )?.[1];
    assert.ok(table, `Missing CREATE TABLE for ${mapped}`);
    for (const line of body.split("\n")) {
      const [, field, type] = line.match(/^\s{2}(\w+)\s+(\w+)\??/) ?? [];
      if (!field || !scalarTypes.has(type)) continue;
      const inCreateTable = new RegExp(`^\\s+"${field}"\\s`, "m").test(table);
      const inAlterTable = new RegExp(
        `ALTER TABLE "public"\\."${mapped}"[\\s\\S]*?ADD (?:COLUMN )?"${field}"`,
      ).test(migration);
      assert.ok(
        inCreateTable || inAlterTable,
        `Missing ${mapped}.${field}`,
      );
    }
  }
});

test("mapped enum values and named constraints/indexes exist in the migration", () => {
  for (const [, enumName, body] of schema.matchAll(
    /enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g,
  )) {
    const mapped = body.match(/@@map\("([^"]+)"\)/)?.[1];
    assert.ok(mapped, `${enumName} must map to a SQL enum`);
    assert.match(migration, new RegExp(`CREATE TYPE "public"\."${mapped}"`));
    for (const [, value] of body.matchAll(/^\s{2}(\w+)\s*$/gm)) {
      assert.match(
        migration,
        new RegExp(`'${value}'`),
        `Missing enum value ${value}`,
      );
    }
  }
  for (const [, name] of schema.matchAll(/map:\s*"([^"]+)"/g)) {
    assert.ok(
      migration.includes(`"${name}"`),
      `Missing mapped SQL object ${name}`,
    );
  }
});

test("every tenant table has forced RLS and sensitive operations use the dedicated function owner", () => {
  for (const table of [
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
  ]) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "public"\."${table}" ENABLE ROW LEVEL SECURITY;`),
    );
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "public"\."${table}" FORCE ROW LEVEL SECURITY;`),
    );
  }
  assert.match(migration, /SET ROLE restoplus_account_ops;/);
  assert.match(
    migration,
    /SECURITY DEFINER SET search_path = pg_catalog, pg_temp/,
  );
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*?FROM PUBLIC;/);
  assert.match(
    migration,
    /Only an active OWNER may promote another member to OWNER/,
  );
  assert.match(
    migration,
    /The last active OWNER cannot be disabled or demoted/,
  );
});

test("orders migration is target-guarded, Prisma-compatible and forbids physical deletion", () => {
  assert.match(
    migration2,
    /current_database\(\) <> 'restoplus_test_disposable'/,
  );
  assert.doesNotMatch(migration2, /^\\(?:set|echo)\b/im);
  assert.doesNotMatch(
    migration2,
    /GRANT [^;]*\bDELETE\b[^;]*\bTO restoplus_app/i,
  );
  assert.match(migration2, /orders_status_transition_guard/);
  assert.match(migration2, /tickets_status_transition_guard/);
  assert.match(migration2, /orders_ticket_consistency_guard/);
  assert.match(migration2, /payments_mobile_reference_check/);
});

test("catalog migration is disposable-only and tenant isolated without physical delete grants", () => {
  assert.match(
    migration3,
    /current_database\(\) <> 'restoplus_test_disposable'/,
  );
  for (const table of [
    "menu_categories",
    "menu_products",
    "menu_product_variants",
    "menu_product_options",
    "menu_product_zone_prices",
  ]) {
    assert.match(
      migration3,
      new RegExp(`ALTER TABLE "public"\\."${table}" ENABLE ROW LEVEL SECURITY;`),
    );
    assert.match(
      migration3,
      new RegExp(`ALTER TABLE "public"\\."${table}" FORCE ROW LEVEL SECURITY;`),
    );
    assert.doesNotMatch(
      migration3,
      new RegExp(`GRANT [^;]*\\bDELETE\\b[^;]*ON "public"\\."${table}"`, "i"),
    );
  }
  assert.match(migration3, /menu_product_zone_prices_product_zone_key/);
  assert.match(migration3, /menu_product_zone_prices_variant_zone_key/);
  assert.match(migration3, /menu_product_options_price_kind_check/);
  assert.match(migration3, /ADD COLUMN "pricingZone"/);
});
