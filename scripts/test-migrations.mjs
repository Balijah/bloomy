import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Client } = require("pg");
const baseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
assert(baseUrl, "Set MIGRATION_TEST_DATABASE_URL to a disposable PostgreSQL instance (requires CREATEDB)");
const admin = new Client({ connectionString: baseUrl });
await admin.connect();
try {
  for (const existing of [false, true]) {
    const name = `bloomy_migrations_${process.pid}_${existing ? "existing" : "fresh"}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(baseUrl);
    url.pathname = `/${name}`;
    const client = new Client({ connectionString: url.href });
    await client.connect();
    try {
      if (existing) {
        await client.query(readFileSync("lib/db/migrations/0000_baseline.sql", "utf8"));
        await client.query("INSERT INTO users (clerk_user_id, email) VALUES ('preserve_me', 'test@example.com')");
        await client.query(readFileSync("lib/db/baseline.sql", "utf8"));
      }
      for (let run = 0; run < 2; run++) {
        const result = spawnSync("pnpm", ["--filter", "@workspace/db", "migrate"], {
          env: { ...process.env, DATABASE_URL: url.href }, encoding: "utf8",
        });
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      }
      const { rows: migrations } = await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at");
      assert.equal(migrations.length, 2);
      assert.equal(migrations[0].hash, createHash("sha256").update(readFileSync("lib/db/migrations/0000_baseline.sql")).digest("hex"));
      await client.query("INSERT INTO stripe_events (stripe_event_id, event_type) VALUES ('evt_test', 'test')");
      if (existing) {
        const { rows } = await client.query("SELECT clerk_user_id FROM users");
        assert.deepEqual(rows, [{ clerk_user_id: "preserve_me" }]);
      }
      console.log(`${existing ? "Existing-schema transition" : "Fresh database"}: migrations and repeat run passed`);
    } finally {
      await client.end();
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
  }
} finally { await admin.end(); }
