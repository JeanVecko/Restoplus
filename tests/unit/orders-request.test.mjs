import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderRequestSchema } from "../../src/server/orders/request.ts";

test("order request accepts identifiers and quantities only", () => {
  const parsed = createOrderRequestSchema.safeParse({
    tableNumber: "Table 01",
    lines: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 2 }],
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal("unitPriceAmount" in parsed.data.lines[0], false);
    assert.equal("station" in parsed.data.lines[0], false);
  }
});

test("client-supplied product prices, currencies, names and stations are rejected", () => {
  for (const forged of [
    { unitPriceAmount: 1 },
    { currency: "USD" },
    { station: "BAR" },
    { productName: "Plat bidon" },
    { selectedExtras: [{ name: "Extra", amount: 0, currency: "CDF" }] },
  ]) {
    const result = createOrderRequestSchema.safeParse({
      tableNumber: "Table 01",
      lines: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1, ...forged }],
    });
    assert.equal(result.success, false);
  }
});
