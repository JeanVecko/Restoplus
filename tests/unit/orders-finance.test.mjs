import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeLineTotal,
  computeOrderTotalsByCurrency,
  computePaymentsByCurrency,
} from "../../src/server/orders/finance.ts";

test("computeLineTotal keeps amounts in original currency with extras of same currency", () => {
  // Ligne en Franc congolais (CDF)
  const lineCdf = {
    productId: "prod-poulet",
    productName: "Poulet braisé",
    station: "CUISINE",
    quantity: 2,
    unitPriceAmount: 25000,
    currency: "CDF",
    selectedExtras: [{ name: "Piment maison", amount: 1000, currency: "CDF" }],
  };

  const resCdf = computeLineTotal(lineCdf);
  assert.equal(resCdf.unitPrice, 26000);
  assert.equal(resCdf.subtotal, 52000);
  assert.equal(resCdf.currency, "CDF");

  // Ligne en Dollar américain (USD)
  const lineUsd = {
    productId: "prod-eau",
    productName: "Eau minérale",
    station: "BAR",
    quantity: 3,
    unitPriceAmount: 2,
    currency: "USD",
  };

  const resUsd = computeLineTotal(lineUsd);
  assert.equal(resUsd.unitPrice, 2);
  assert.equal(resUsd.subtotal, 6);
  assert.equal(resUsd.currency, "USD");
});

test("computeOrderTotalsByCurrency aggregates totals by native currency without automatic conversion", () => {
  const lines = [
    {
      productId: "p1",
      productName: "Poulet braisé",
      station: "CUISINE",
      quantity: 1,
      unitPriceAmount: 25000,
      currency: "CDF",
    },
    {
      productId: "p2",
      productName: "Poisson grillé",
      station: "CUISINE",
      quantity: 1,
      unitPriceAmount: 30000,
      currency: "CDF",
    },
    {
      productId: "p3",
      productName: "Eau minérale",
      station: "BAR",
      quantity: 2,
      unitPriceAmount: 2,
      currency: "USD",
    },
  ];

  const totals = computeOrderTotalsByCurrency(lines);
  assert.equal(totals.CDF, 55000);
  assert.equal(totals.USD, 4);
});

test("computePaymentsByCurrency sums received payments in their respective currencies", () => {
  const payments = [
    { method: "CASH_CDF", amountPaid: 20000, currencyPaid: "CDF" },
    { method: "MPESA", amountPaid: 35000, currencyPaid: "CDF", referenceNumber: "MP123" },
    { method: "CASH_USD", amountPaid: 10, currencyPaid: "USD" },
  ];

  const totals = computePaymentsByCurrency(payments);
  assert.equal(totals.CDF, 55000);
  assert.equal(totals.USD, 10);
});

test("computeLineTotal rejects extra with incompatible currency", () => {
  const line = {
    productId: "p1",
    productName: "Poisson",
    station: "CUISINE",
    quantity: 1,
    unitPriceAmount: 25000,
    currency: "CDF",
    selectedExtras: [{ name: "Sauce", amount: 2, currency: "USD" }],
  };

  assert.throws(
    () => computeLineTotal(line),
    /Devise de supplément incompatible/,
  );
});
