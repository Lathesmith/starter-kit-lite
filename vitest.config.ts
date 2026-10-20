import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

// Tests run inside workerd (the real Workers runtime) with an isolated D1 database per test file.
// Migrations are applied by tests/setup/apply-migrations.ts before each file runs.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ENV: "test",
            APP_URL: "http://localhost:8787",
            ADMIN_EMAILS: "admin@example.com",
          },
        },
      }),
    ],
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/setup/apply-migrations.ts"],
    },
  };
});
