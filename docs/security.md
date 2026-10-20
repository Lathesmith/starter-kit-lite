# Security

What the kit does, what it assumes, and what it leaves to you.

## Built in

| Area               | Measure                                                                                                                                                                                 | Where                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Transport          | Cloudflare terminates TLS; cookies are `Secure` in production                                                                                                                           | `src/auth/cookies.ts`                 |
| Sessions           | 256-bit random tokens, SHA-256 at rest, 30-day server-side expiry, revocable, `HttpOnly; SameSite=Lax; __Host-`                                                                         | `src/auth/`                           |
| Sign-in links      | 256-bit random, hashed, 15-minute TTL, single use via conditional update, consumed on POST (prefetch-safe), 5 per address per 15 minutes                                                | `src/auth/service.ts`                 |
| CSRF               | Origin check on every cookie-authenticated form post (Hono `csrf`); machine routes never use cookies                                                                                    | `src/app.tsx`                         |
| Open redirects     | `safeNextPath` allows same-origin paths only and re-validates after normalisation                                                                                                       | `src/auth/middleware.ts`              |
| Headers            | CSP (`default-src 'self'`, no inline scripts, `frame-ancestors 'none'`, `form-action` limited to self + Stripe), `X-Content-Type-Options: nosniff`, referrer policy                     | `src/app.tsx`                         |
| Input              | zod schemas with length and count limits on every user input; numbers clamped                                                                                                           | `src/lib/validate.ts`, services       |
| Data scoping       | Every per-user query filters by `user_id`; other users' records are 404                                                                                                                 | services                              |
| SQL                | Parameterised statements only                                                                                                                                                           | `src/lib/db.ts`                       |
| Errors             | Users see generic messages; details go to logs                                                                                                                                          | `src/app.tsx`                         |
| API keys           | `ak_` prefix (scanner-friendly), hashed at rest, bearer only, revocable, 10 per user                                                                                                    | `src/api-keys/`                       |
| Rate limits        | Per key per minute and per user per month                                                                                                                                               | `src/metering/`                       |
| Webhooks           | HMAC-SHA256 signature over the raw body, constant-time compare, 5-minute replay window, event-id deduplication, idempotent handlers                                                     | `src/billing/stripe.ts`, `webhook.ts` |
| Off-site redirects | Only https URLs from Stripe's API or configuration                                                                                                                                      | `src/billing/routes.tsx`              |
| Secrets            | `.dev.vars` git-ignored; `wrangler secret put` in production; Claude Code hooks block common ways of committing secrets (pattern-based guard; see `docs/claude-code-pack.md`, "Limits") | `.gitignore`, `.claude/hooks/`        |
| Dev tooling        | `/dev/*` routes return 404 unless `APP_ENV` is `development`/`test` AND the request host is loopback (fails closed)                                                                     | `devOnly` middleware                  |
| Dependencies       | Two runtime packages (hono, zod), licence check in CI                                                                                                                                   | `scripts/licenses.mjs`                |

## Assumptions

- `APP_ENV` is `production` on the deployed Worker. The kit fails closed if it is not: any value other than exactly `development` or `test` is treated as production, `/dev/outbox` only answers on a loopback host, and the session cookie is `Secure` on every HTTPS request. Still set it, so emails go through Resend instead of the outbox.
- `APP_URL` matches the real origin. The CSRF check compares `Origin` to the request URL's origin, which Cloudflare sets to the public host.
- Admins are trusted. Admin pages are read-mostly, but "sign out everywhere" is a write.
- Stripe is the merchant of record for card data; this app never sees a card number.

## Not included (add when you need them)

- Two-factor authentication, passkeys, OAuth sign-in.
- Audit log of admin actions.
- IP-based rate limiting of the login form (the per-address limit protects recipients; add Cloudflare WAF rate-limiting rules for the endpoint if you see abuse; the free plan includes one rule).
- Account deletion / data export UI (needed for GDPR/CCPA requests; the data model makes it a few queries).
- Bot protection on the login form (Cloudflare Turnstile is free and fits the CSP with one `script-src` addition).
- Content moderation of user content.

## Reviewing changes

The `security-review` skill (`.claude/skills/security-review/SKILL.md`) is a checklist tuned to this codebase. Run it on every pull request that touches auth, billing, API or MCP code.

## Reporting a vulnerability in the kit

Email the support address on the store page with reproduction steps. Please do not test against other people's deployments.
