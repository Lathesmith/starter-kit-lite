# Lathesmith Starter Kit

A small, fast SaaS starter for **Cloudflare Workers + D1** that an AI coding agent can extend safely. Strict TypeScript, [Hono](https://hono.dev), server-rendered pages, passwordless sign-in, tests that run inside the real Workers runtime, and tag-based deploys. Everything runs on Cloudflare's free plan.

Built and maintained by Lathesmith with AI assistance.

## Editions

|                                                                                                                                          | Lite (MIT, free) | Full (commercial licence) |
| ---------------------------------------------------------------------------------------------------------------------------------------- | :--------------: | :-----------------------: |
| Cloudflare Workers + D1, static assets, cron                                                                                             |       yes        |            yes            |
| Magic-link sign-in, secure server-side sessions, CSRF, strict CSP                                                                        |       yes        |            yes            |
| Landing page, dashboard, demo "notes" resource, privacy/terms templates                                                                  |       yes        |            yes            |
| Vitest inside workerd with a fresh D1 per test file                                                                                      |       yes        |            yes            |
| GitHub Actions: typecheck, test, deploy on `v*` tags                                                                                     |       yes        |            yes            |
| `CLAUDE.md` / `AGENTS.md`                                                                                                                |      basic       |         thorough          |
| Stripe: hosted Checkout + Payment Links, verified webhooks, idempotent fulfilment, subscriptions and one-time purchases, customer portal |                  |            yes            |
| Customer API keys with per-minute rate limits and monthly quotas                                                                         |                  |            yes            |
| JSON API (`/api/v1`)                                                                                                                     |                  |            yes            |
| Remote MCP server (`/mcp`) exposing the app to AI agents, same keys, metered                                                             |                  |            yes            |
| Admin views (users, subscriptions, Stripe events, email log)                                                                             |                  |            yes            |
| Transactional email via Resend, with a local outbox for development                                                                      |                  |            yes            |
| Claude Code pack: 10 validated skills + 3 hooks (format on write, block secret commits, protect tracked files)                           |                  |            yes            |
| Step-by-step docs (billing, metering, MCP, deploy, security, testing...)                                                                 |    core docs     |            all            |

This is the free **Lite edition** (MIT). The **Full edition** adds everything in the right-hand column above: Stripe billing with verified, idempotent webhooks, customer API keys with rate limits and quotas, a JSON API, a remote MCP server, admin views, Resend email, the Claude Code pack (10 skills, 3 hooks) and the full documentation set, under a single-developer commercial licence. It is a one-time purchase: [Lathesmith Starter Kit, Full edition](https://lathesmith.gumroad.com/l/starter-kit). `docs/editions.md` lists exactly what differs.

## Quick start

Prerequisites: Node 20 or newer and git. No Cloudflare, Stripe or Resend account is needed to run locally.

```
npm install
# Windows (cmd):        copy .dev.vars.example .dev.vars
# Windows (PowerShell): Copy-Item .dev.vars.example .dev.vars
# macOS / Linux:        cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Open http://localhost:8787, click **Sign in**, enter any email, then open http://localhost:8787/dev/outbox and click the link. You are on the dashboard. Full walkthrough and troubleshooting: `docs/quickstart.md`.

Checks: `npm run typecheck`, `npm test`, or everything CI runs with `npm run check`.

## Documentation

| Guide                   | What it covers                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| `docs/quickstart.md`    | Fresh clone to running app on Windows, macOS and Linux; troubleshooting |
| `docs/architecture.md`  | Request flow, modules, data model, design decisions                     |
| `docs/auth.md`          | Magic links and sessions; why not a library; swapping in Better Auth    |
| `docs/add-a-feature.md` | Replace the demo "notes" with your own resource, end to end             |
| `docs/email.md`         | Resend setup, the local outbox, limits                                  |
| `docs/testing.md`       | How the test runtime works, helpers, stubbing outbound HTTP             |
| `docs/deploy.md`        | Cloudflare setup, secrets, CI secrets, first deploy, rollback           |
| `docs/security.md`      | The security model and what the kit does not include                    |
| `docs/editions.md`      | What the Lite and Full editions contain                                 |

## Licence

The Lite edition is MIT licensed (see its `LICENSE`).
