# Architecture

## One request's journey

```
Browser / API client / AI agent
        |
Cloudflare edge: static assets from public/ are served first (style.css, favicon.svg)
        |
src/index.ts  -> app.fetch                       (also: scheduled() runs the daily cron)
src/app.tsx   -> secureHeaders (CSP, nosniff, frame-ancestors, referrer policy)
              -> csrf()           for cookie routes only: form posts must carry a same-origin Origin header
              -> attachSession    loads user + session from the cookie, if any
              -> feature routers  marketing, auth, dashboard (notes)
                                  [Full] billing, webhooks, api-keys, /api/v1, /mcp, /admin
              -> notFound / onError  HTML for pages, JSON for machine routes
```

Machine routes (`/api/*`, `/webhooks/*`, `/mcp`) skip CSRF and cookies entirely: they authenticate with bearer API keys or Stripe signatures, so a browser can never be tricked into calling them with ambient credentials.

## Modules

| Folder          | Responsibility                                                                                          | Entry points                           |
| --------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `src/lib`       | Crypto (random tokens, SHA-256, HMAC, constant-time compare), D1 helpers, `AppError`, zod helpers, time | used everywhere                        |
| `src/auth`      | Magic links, sessions, cookie flags, `requireUser` / `requireAdmin` / `devOnly`, `safeNextPath`         | `authRoutes`                           |
| `src/email`     | `sendEmail` (Resend or local outbox), templates                                                         | called by services                     |
| `src/notes`     | The demo resource: SQL + zod in `service.ts`, HTML in `routes.tsx`                                      | `dashboardRoutes`                      |
| `src/marketing` | Landing, privacy, terms, `/health`, `/dev/outbox`                                                       | `marketingRoutes`                      |
| `src/ui`        | `Layout` and page components (Hono JSX, rendered on the server)                                         | imported by routes                     |
| `src/billing`   | Plan catalogue, Stripe client + signature verification, fulfilment, checkout routes, webhook            | `billingRoutes`, `stripeWebhookRoutes` |
| `src/api-keys`  | Key creation/revocation, bearer middleware, dashboard page                                              | `apiKeyRoutes`, `requireApiKey`        |
| `src/metering`  | Per-key rate limit from `usage_events`, per-user monthly quota from `usage_monthly`                     | `metered()`                            |
| `src/api`       | JSON API `/api/v1`                                                                                      | `apiRoutes`                            |
| `src/mcp`       | MCP server (JSON-RPC over HTTP), tool definitions                                                       | `mcpRoutes`                            |
| `src/admin`     | Admin pages                                                                                             | `adminRoutes`                          |

The rule that keeps this maintainable: **services own logic; routes are thin; every surface calls the same service**. The notes resource is reachable from the dashboard, the JSON API and the MCP server through one `src/notes/service.ts`.

## Data model

Timestamps are Unix seconds. Ids are `prefix_` + 32 hex characters. Tokens are stored as SHA-256 hashes, never raw.

```
users              id, email (unique), role (user|admin), plan (free|pro|lifetime), created_at, last_login_at
sessions           id = sha256(cookie token), user_id, created_at, expires_at (30 d), last_seen_at, user_agent
magic_links        id = sha256(url token), email, created_at, expires_at (15 min), used_at
email_log          id, to_email, subject, text_body, provider (resend|outbox), provider_id, status, error, created_at
notes              id, user_id, title, body, created_at, updated_at

[Full]
stripe_events      id = Stripe event id (idempotency key), type, created, received_at, processing_at (claim), processed_at, error
stripe_customers   customer_id (pk), user_id (a user may have several customers), created_at
subscriptions      id = sub_..., user_id, customer_id, price_id, plan, status, current_period_end, cancel_at_period_end, stripe_updated_at
purchases          id = Checkout Session id, user_id, payment_intent_id, price_id, plan, amount_total, currency, status (paid|refunded)
api_keys           id, user_id, name, key_hash (unique), key_prefix, created_at, last_used_at, revoked_at
usage_events       id, user_id, api_key_id, endpoint, units, created_at (one row per rate-limit slot)
usage_monthly      user_id + month (pk), units (quota counter, kept by triggers on usage_events)
```

`users.plan` is derived state: `recomputePlan()` in `src/billing/service.ts` is its only writer, and it is recalculated from `subscriptions` and `purchases` after every relevant webhook.

## Design decisions and why

| Decision                                               | Reason                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hono + server-rendered JSX, no client framework        | Pages are fast and simple, there is nothing to hydrate, and the CSP can forbid inline scripts. Add client-side JS per page only where it earns its place.                                               |
| Plain SQL, no ORM                                      | Readable by humans and agents, no adapter for D1, no schema-generation step, no version churn. The helpers in `src/lib/db.ts` are 30 lines.                                                             |
| Hand-written magic-link auth instead of a library      | ~200 auditable lines, no ORM dependency, no OAuth surface to secure. `docs/auth.md` explains the trade-off and how to swap in Better Auth.                                                              |
| Stripe via a 120-line fetch client instead of the SDK  | Four calls are needed. Signature verification is 30 lines of WebCrypto. Swapping in the official SDK is a local change.                                                                                 |
| Checkout always on Stripe-hosted pages                 | Cloudflare's free-plan terms do not allow collecting card data on the site; hosted Checkout also handles SCA, wallets and tax.                                                                          |
| Fulfilment only via webhooks, deduplicated by event id | Redirect-based fulfilment can be forged or missed; webhooks retry. Dedup plus idempotent upserts make replays harmless.                                                                                 |
| Metering with one conditional insert per request       | One atomic statement checks both limits; the quota is a counter row, so a request's cost does not grow with usage (about 4 rows written per call). `docs/api-keys-and-metering.md` lists upgrade paths. |
| Stateless MCP over HTTP, tools only                    | Works on the free plan without Durable Objects; the protocol subset covers what tool-using agents need.                                                                                                 |
| Tests in workerd with a real D1                        | Catches runtime differences (no Node APIs, real SQLite semantics) that Node-based tests miss.                                                                                                           |
| Two editions from one tree via markers                 | One codebase to maintain; both editions are built and tested from it before every release.                                                                                                              |

## Scheduled work

`src/index.ts` exports `scheduled()`, wired to a daily cron in `wrangler.jsonc` (`triggers.crons`, uncomment to enable). It purges expired sessions and magic links, and usage events older than 90 days.

## Limits on the Cloudflare free plan (as of late 2026; re-check)

100k requests/day, 10 ms CPU per request, D1 5 GB, 5 million rows read and 100k rows written per day, 5 cron triggers. The kit's hot paths do 1-3 D1 statements per request. If you outgrow this, Workers Paid is $5/month and raises these limits.
