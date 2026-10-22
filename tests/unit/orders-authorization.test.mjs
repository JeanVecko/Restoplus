import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canApplyDiscount,
  canCancelOrder,
  canCreateOrder,
  canProcessPayment,
  canSetDailyExchangeRate,
  canTransitionTicketStatus,
  canUpdateTicketStatus,
  canValidateOrderAtCashier,
} from "../../src/server/orders/authorization.ts";

const allRoles = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "STOCK_MANAGER",
];

test("canCreateOrder allows OWNER, MANAGER, CASHIER, WAITER, rejects others", () => {
  assert.equal(canCreateOrder("OWNER"), true);
  assert.equal(canCreateOrder("MANAGER"), true);
  assert.equal(canCreateOrder("CASHIER"), true);
  assert.equal(canCreateOrder("WAITER"), true);
  assert.equal(canCreateOrder("KITCHEN"), false);
  assert.equal(canCreateOrder("STOCK_MANAGER"), false);
});

test("canValidateOrderAtCashier allows cashier roles and rejects operational wait staff", () => {
  assert.equal(canValidateOrderAtCashier("OWNER"), true);
  assert.equal(canValidateOrderAtCashier("MANAGER"), true);
  assert.equal(canValidateOrderAtCashier("CASHIER"), true);
  assert.equal(canValidateOrderAtCashier("WAITER"), false);
  assert.equal(canValidateOrderAtCashier("KITCHEN"), false);
  assert.equal(canValidateOrderAtCashier("STOCK_MANAGER"), false);
});

test("canUpdateTicketStatus allows KITCHEN, MANAGER, OWNER and rejects WAITER, CASHIER", () => {
  assert.equal(canUpdateTicketStatus("OWNER"), true);
  assert.equal(canUpdateTicketStatus("MANAGER"), true);
  assert.equal(canUpdateTicketStatus("KITCHEN"), true);
  assert.equal(canUpdateTicketStatus("WAITER"), false);
  assert.equal(canUpdateTicketStatus("CASHIER"), false);
  assert.equal(canUpdateTicketStatus("STOCK_MANAGER"), false);
});

test("canCancelOrder and canApplyDiscount are strictly restricted to OWNER and MANAGER", () => {
  for (const role of allRoles) {
    const expected = role === "OWNER" || role === "MANAGER";
    assert.equal(
      canCancelOrder(role),
      expected,
      `Cancel check failed for ${role}`,
    );
    assert.equal(
      canApplyDiscount(role),
      expected,
      `Discount check failed for ${role}`,
    );
    assert.equal(
      canSetDailyExchangeRate(role),
      expected,
      `Exchange rate check failed for ${role}`,
    );
  }
});

test("canProcessPayment allows cashiers, managers and owners", () => {
  assert.equal(canProcessPayment("OWNER"), true);
  assert.equal(canProcessPayment("MANAGER"), true);
  assert.equal(canProcessPayment("CASHIER"), true);
  assert.equal(canProcessPayment("WAITER"), false);
  assert.equal(canProcessPayment("KITCHEN"), false);
  assert.equal(canProcessPayment("STOCK_MANAGER"), false);
});

test("ticket transitions are forward-only", () => {
  assert.equal(canTransitionTicketStatus("PENDING", "IN_PREPARATION"), true);
  assert.equal(canTransitionTicketStatus("IN_PREPARATION", "READY"), true);
  assert.equal(canTransitionTicketStatus("PENDING", "READY"), false);
  assert.equal(canTransitionTicketStatus("READY", "IN_PREPARATION"), false);
  assert.equal(canTransitionTicketStatus("READY", "PENDING"), false);
});
