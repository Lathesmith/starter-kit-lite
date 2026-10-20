import { applyD1Migrations, env } from "cloudflare:test";

// Each test file gets a fresh, isolated D1 database; apply the migrations folder to it.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
