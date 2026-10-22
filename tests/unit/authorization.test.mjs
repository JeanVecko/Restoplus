import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageMember,
  isOperationalInviteRole,
} from "../../src/server/accounts/authorization.ts";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

test("OWNER can promote another active member to OWNER", () => {
  assert.equal(
    canManageMember({
      actorId: owner,
      actorRole: "OWNER",
      targetId: other,
      targetRole: "WAITER",
      newRole: "OWNER",
    }),
    true,
  );
});

test("MANAGER can manage operational roles but cannot assign OWNER", () => {
  assert.equal(
    canManageMember({
      actorId: owner,
      actorRole: "MANAGER",
      targetId: other,
      targetRole: "WAITER",
      newRole: "KITCHEN",
    }),
    true,
  );
  assert.equal(
    canManageMember({
      actorId: owner,
      actorRole: "MANAGER",
      targetId: other,
      targetRole: "WAITER",
      newRole: "OWNER",
    }),
    false,
  );
});

test("a member cannot self-promote", () => {
  assert.equal(
    canManageMember({
      actorId: owner,
      actorRole: "MANAGER",
      targetId: owner,
      targetRole: "MANAGER",
      newRole: "OWNER",
    }),
    false,
  );
});

test("MANAGER cannot modify an OWNER", () => {
  assert.equal(
    canManageMember({
      actorId: owner,
      actorRole: "MANAGER",
      targetId: other,
      targetRole: "OWNER",
      newRole: "WAITER",
    }),
    false,
  );
});

test("only non-OWNER roles are inviteable", () => {
  assert.equal(isOperationalInviteRole("OWNER"), false);
  assert.equal(isOperationalInviteRole("MANAGER"), true);
  assert.equal(isOperationalInviteRole("STOCK_MANAGER"), true);
});
