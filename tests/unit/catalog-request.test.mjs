import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProductSchema,
  updateProductSchema,
} from "../../src/server/catalog/request.ts";

const categoryId = "00000000-0000-4000-8000-000000000010";

test("catalog request supports distinct variant tariffs by zone without client tenant or currency override", () => {
  const result = createProductSchema.safeParse({
    categoryId,
    name: "Poulet braisé",
    preparationStation: "CUISINE",
    currency: "CDF",
    standardPriceAmount: "25000",
    zonePrices: [{ zone: "TERRACE", priceAmount: "27000" }],
    variants: [{
      name: "Entier",
      standardPriceAmount: "42000",
      zonePrices: [
        { zone: "TERRACE", priceAmount: "44000" },
        { zone: "VIP", priceAmount: "48000" },
      ],
    }],
    options: [
      { name: "Riz", kind: "INCLUDED", priceAmount: "0" },
      { name: "Sauce supplémentaire", kind: "PAID", priceAmount: "1000" },
    ],
  });
  assert.equal(result.success, true);
});

test("catalog rejects duplicate zone prices, free paid extras, priced included options, and unknown fields", () => {
  const base = {
    categoryId,
    name: "Jus",
    preparationStation: "BAR",
    currency: "USD",
    standardPriceAmount: "2.50",
  };
  assert.equal(createProductSchema.safeParse({
    ...base,
    zonePrices: [
      { zone: "VIP", priceAmount: "3" },
      { zone: "VIP", priceAmount: "4" },
    ],
  }).success, false);
  assert.equal(createProductSchema.safeParse({
    ...base,
    options: [{ name: "Extra gratuit", kind: "PAID", priceAmount: "0" }],
  }).success, false);
  assert.equal(createProductSchema.safeParse({
    ...base,
    options: [{ name: "Riz inclus", kind: "INCLUDED", priceAmount: "1" }],
  }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, restaurantId: categoryId }).success, false);
});

test("catalog price updates require decimal strings and reject negative or excessive precision", () => {
  assert.equal(updateProductSchema.safeParse({ standardPriceAmount: "-1" }).success, false);
  assert.equal(updateProductSchema.safeParse({ standardPriceAmount: "1.001" }).success, false);
  assert.equal(updateProductSchema.safeParse({ standardPriceAmount: "12.50" }).success, true);
});
