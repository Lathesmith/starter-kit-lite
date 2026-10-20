# CLAUDE.md

Guidance for AI coding agents (Claude Code and compatible tools) working in this repository. `AGENTS.md` is the same content in the vendor-neutral format.

## What this is

A small SaaS starter on **Cloudflare Workers + D1**, written in strict TypeScript with [Hono](https://hono.dev). Server-rendered HTML (Hono JSX), passwordless email sign-in, a demo "notes" resource, tests that run inside the real Workers runtime, and GitHub Actions deploys.

## Commands

| Task                   | Command                                                      |
| ---------------------- | ------------------------------------------------------------ |
| Install                | `npm install` (also generates `worker-configuration.d.ts`)   |
| Run locally            | `npm run dev` then open http://localhost:8787                |
| Apply local migrations | `npm run db:migrate:local` (reset: `npm run db:reset:local`) |
| Typecheck              | `npm run typecheck`                                          |
| Tests                  | `npm test`                                                   |
| Everything CI runs     | `npm run check`                                              |
| Format                 | `npm run format`                                             |

Always run `npm run typecheck && npm test` before reporting a task as done.

## Layout

```
src/
  index.ts          Worker entry (fetch + scheduled cron)
  app.tsx           Hono app: security headers, CSRF, session loading, route mounting, error pages
  env.ts            AppEnv (bindings + vars + secrets) and shared row types
  lib/              crypto, db helpers, errors, validation, time
  auth/             magic links, sessions, cookies, middleware (requireUser / requireAdmin)
  email/            mailer (Resend or local outbox), templates
  notes/            demo resource: service.ts (SQL + zod) and routes.tsx (HTML)
  marketing/        landing, privacy, terms, /health, /dev/outbox
  ui/               layout.tsx and pages/*.tsx (server-rendered JSX)
migrations/         D1 SQL, applied in order; never edit an applied migration
public/             static assets (style.css, favicon)
tests/              Vitest, runs in workerd with a fresh D1 per file; helpers.ts has signIn/formPost
docs/               guides; start with docs/quickstart.md and docs/architecture.md
```

## Conventions

- **Plain SQL** through `src/lib/db.ts` (`one`, `all`, `run`, `count`). Parameters only; never interpolate.
- **Scope everything by user.** Every query on user data has `WHERE user_id = ?`. Admin pages use `requireAdmin`.
- **Validate with zod** at the edge (`parseOrThrow`). Enforce max lengths and counts.
- **Errors:** throw `AppError`s from `src/lib/errors.ts`; `app.onError` renders HTML or JSON depending on the route.
- **Forms:** plain `<form method="post">`, redirect 303 after success. CSRF is an Origin check in `app.tsx`; no tokens needed.
- **Secrets:** `.dev.vars` locally, `wrangler secret put` in production. Never in `wrangler.jsonc`, source, tests or docs. The hooks in `.claude/hooks/` block commits and writes containing recognisable secret formats; they are a pattern-based guard, not a guarantee (see `docs/claude-code-pack.md`, "Limits").
- **Timestamps** are Unix seconds (`now()` in `src/lib/time.ts`). **Ids** come from `newId("prefix")`.
- **Tokens** (sessions, magic links, API keys) are random and stored hashed.
- **Formatting:** Prettier, 100 columns. The post-write hook formats files automatically.

## Security model (do not weaken)

Session cookie `HttpOnly; SameSite=Lax; Secure; __Host-` in production. Magic links expire in 15 minutes, work once, are consumed on POST. Strict CSP, no inline scripts. Webhooks verified over the raw body with a 5-minute replay window and deduplicated by event id. API keys bearer-only. `/dev/*` disabled in production.

## When adding things

1. Service function (SQL + zod) first, then the route(s), then tests, then docs.
2. New feature folder: `src/<feature>/{service.ts,routes.tsx}`, mounted in `src/app.tsx`.
3. Tests go in `tests/<feature>.test.ts`; cover authorization (another user gets 404, anonymous gets 302/401), not just the happy path.
4. Do not add dependencies without a reason; anything added must be MIT/Apache-2.0/BSD/ISC (`npm run licenses:check`).

## Things agents must not do here

- Deploy, create tags, or touch Cloudflare/Stripe/Resend dashboards unless the user explicitly asks for that step.
- Commit `.dev.vars`, keys, or tokens (the pre-commit hook will refuse anyway).
- Weaken CSRF, CSP, cookie flags, signature checks or rate limits to make a test pass.
- Edit an already-applied migration; add a new one.
