import { test } from "node:test";
import assert from "node:assert/strict";
import { assertProductionConfig, missingProductionConfig } from "./startup-config";

const complete = { NODE_ENV: "production", DATABASE_URL: "postgres://x", SESSION_SECRET: "s", CLERK_SECRET_KEY: "sk_test_x" };

test("production startup names every missing required setting without echoing values", () => {
  assert.deepEqual(missingProductionConfig(complete), []);
  assert.deepEqual(missingProductionConfig({ ...complete, CLERK_SECRET_KEY: undefined, SESSION_SECRET: "  " }), ["SESSION_SECRET", "CLERK_SECRET_KEY"]);
  assert.throws(() => assertProductionConfig({ ...complete, CLERK_SECRET_KEY: "" }), (error: Error) =>
    /CLERK_SECRET_KEY/.test(error.message) && !/postgres:\/\/x/.test(error.message));
  assert.doesNotThrow(() => assertProductionConfig(complete));
});

test("development startup does not require production secrets", () => {
  assert.deepEqual(missingProductionConfig({ NODE_ENV: "development" }), []);
});
