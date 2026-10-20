# Testing

Tests run **inside the Workers runtime** (`workerd`) through `@cloudflare/vitest-pool-workers`, with a real D1 database. That means no Node-only APIs sneak into production code, SQLite semantics are exact, and `SELF.fetch` exercises the full middleware chain.

## Layout

| File                               | Covers                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tests/unit.test.ts`               | Crypto helpers, redirect hardening, cookie names, production-mode behaviour via `app.request()` with a custom env              |
| `tests/auth.test.ts`               | Magic-link flow, token reuse/expiry, rate limit, CSRF, logout, admin role, security headers                                    |
| `tests/notes.test.ts`              | The demo resource: CRUD, validation, user scoping                                                                              |
| `tests/billing-unit.test.ts`       | Stripe form encoding, signature parsing/verification, plan mapping, Payment Link redirect                                      |
| `tests/stripe-webhook.test.ts`     | Signature rejection cases, fulfilment for subscriptions/one-time/Payment Links, dedup, cancellation, refund, checkout redirect |
| `tests/billing-edge-cases.test.ts` | Out-of-order events, paid-but-unfulfillable checkouts (needs review), upgrade and downgrade emails, checkout entitlement rules |
| `tests/api-and-metering.test.ts`   | Keys lifecycle, bearer auth, JSON API CRUD, rate limit, quota, scoping                                                         |
| `tests/mcp.test.ts`                | Handshake, tools/list, tools/call, validation, batches, errors, metering                                                       |
| `tests/admin.test.ts`              | Access control and pages                                                                                                       |
| `tests/hooks.test.ts`              | The secret-detection logic behind the Claude Code hooks                                                                        |

`npm test` runs Vitest and then `scripts/check-skills.mjs`, which validates the Claude Code pack (frontmatter, referenced paths and scripts, hook commands anchored on `$CLAUDE_PROJECT_DIR`) and runs each hook from a subdirectory to check it still blocks and formats.

## How a test file runs

1. `vitest.config.ts` reads `migrations/` with `readD1Migrations` and passes them as a binding, plus test-only vars (`APP_ENV=test`, admin email, placeholder Stripe values).
2. `tests/setup/apply-migrations.ts` applies them to the file's isolated D1 before the tests.
3. Tests call `SELF.fetch(...)` (the worker) or import modules directly.

Each file gets its own storage, so files do not interfere; tests within a file share the database and use distinct email addresses.

## Helpers (`tests/helpers.ts`)

- `signIn(email)` runs the real magic-link flow and returns `{ cookie }`.
- `formPost(path, fields, cookie?)` sends a form the way a browser does, including the `Origin` header the CSRF middleware requires.
- `get(path, cookie?)` fetches with `redirect: "manual"`.
- `latestMagicToken(email)` reads the newest link from the outbox table.
- `userIdFor(email)`.

## Stubbing outbound HTTP

The main worker runs in the same isolate as the tests, so `vi.spyOn(globalThis, "fetch")` intercepts calls the app makes to Stripe or Resend while `SELF.fetch` (a service binding) is unaffected. `tests/stripe-helpers.ts` has a `stubStripe()` helper that records every call. (`fetchMock` from `cloudflare:test` was removed in the Vitest 4 line of the pool; the spy approach is the replacement.)

## Testing production-only behaviour

`app.request(url, init, env)` lets a test pass a custom env object (for example `APP_ENV: "production"`) while reusing the real D1 binding. See the production-mode cases in `tests/unit.test.ts`.

## Compatibility date

`compatibility_date` in `wrangler.jsonc` must not be newer than the runtime bundled with `@cloudflare/vitest-pool-workers`, or the tests fail to start with a clear message. When you bump wrangler, also bump the pool package, then raise the date.

## Running

```
npm test                                   # everything
npx vitest run tests/auth.test.ts          # one file
npx vitest run -t "rate limit"             # by name
npx vitest                                 # watch mode
```
