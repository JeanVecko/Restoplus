import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  verifyPassword,
} from "../../src/server/auth/password.ts";

test("scrypt password hashes verify only the matching password", async () => {
  const hash = await hashPassword("synthetic-test-password-42");
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword("synthetic-test-password-42", hash), true);
  assert.equal(
    await verifyPassword("different-synthetic-password", hash),
    false,
  );
});
