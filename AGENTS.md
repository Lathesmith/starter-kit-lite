# AGENTS.md

Instructions for AI coding agents working in this repository (vendor-neutral format; `CLAUDE.md` holds the same guidance with Claude Code specifics).

## Project

A SaaS starter on Cloudflare Workers + D1, strict TypeScript, Hono, server-rendered HTML, magic-link sign-in, D1 migrations, Vitest running inside the Workers runtime, GitHub Actions deploy on tags.

## Setup and commands

- `npm install` (Node 20+; generates `worker-configuration.d.ts`)
- `npm run dev` (http://localhost:8787; sign-in links appear at `/dev/outbox` when no email provider is configured)
- `npm run db:migrate:local`
- `npm run typecheck`, `npm test`, `npm run check` (all checks, same as CI)

Run `npm run typecheck && npm test` before declaring work complete. Do not skip or weaken tests.

## Code style

- Prettier (100 columns), strict TypeScript with `exactOptionalPropertyTypes`.
- Plain parameterized SQL via `src/lib/db.ts`; zod validation via `src/lib/validate.ts`; errors via `src/lib/errors.ts`.
- Services (`src/<feature>/service.ts`) hold logic; routes (`routes.tsx`) are thin.
- Every query on user data is scoped by `user_id`.
- Timestamps are Unix seconds; ids from `newId("prefix")`; tokens random and stored hashed.

## Boundaries

- Never commit secrets. Local secrets live in `.dev.vars` (git-ignored); production secrets are set with `wrangler secret put`.
- Never edit an applied migration; add a new numbered file in `migrations/`.
- Do not deploy, tag, or change third-party dashboards unless explicitly asked.
- Do not weaken security middleware (CSRF, CSP, cookie flags, webhook signature checks, rate limits).

## Testing

Tests live in `tests/` and run in workerd with a fresh D1 database per file (`tests/setup/apply-migrations.ts`). Use `signIn`, `formPost`, `get` from `tests/helpers.ts`. Cover authorization and validation, not only the happy path.
