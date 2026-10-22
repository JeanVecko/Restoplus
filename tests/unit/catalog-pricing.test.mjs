import assert from "node:assert/strict";
import test from "node:test";
import { resolveCatalogBasePrice } from "../../src/server/catalog/pricing.ts";

test("standard pricing uses the variant tariff when a variant is selected", () => {
  assert.equal(resolveCatalogBasePrice({
    zone: "STANDARD",
    productStandard: "10000.00",
    variantStandard: "14000.00",
  }), "14000.00");
});

test("zone pricing uses an explicit variant override without conversion", () => {
  assert.equal(resolveCatalogBasePrice({
    zone: "VIP",
    productStandard: "10000.00",
    productVip: "15000.00",
    variantStandard: "14000.00",
    variantVip: "20000.00",
  }), "20000.00");
});

test("missing variant zone tariff falls back to product zone, then product Standard", () => {
  assert.equal(resolveCatalogBasePrice({
    zone: "TERRACE",
    productStandard: "10000.00",
    productTerrace: "12500.00",
    variantStandard: "14000.00",
  }), "12500.00");
  assert.equal(resolveCatalogBasePrice({
    zone: "VIP",
    productStandard: "10000.00",
    variantStandard: "14000.00",
  }), "10000.00");
});

test("takeaway Standard pricing does not use a zone override", () => {
  assert.equal(resolveCatalogBasePrice({
    zone: "STANDARD",
    productStandard: "10000.00",
    productTerrace: "12500.00",
    variantStandard: "14000.00",
    variantTerrace: "17000.00",
  }), "14000.00");
});
