# Editions

The kit comes in two editions built from one codebase:

- **Lite** (free, MIT): Cloudflare Workers + D1, magic-link sign-in and sessions, the dashboard with the demo "notes" resource, landing/privacy/terms pages, tests inside the Workers runtime, GitHub Actions CI and tag-based deploys, a basic `CLAUDE.md` / `AGENTS.md`, and the core docs.
- **Full** (commercial licence, see `LICENSE`): everything in Lite, plus Stripe billing (`src/billing/`, migrations `0002` and `0004`), customer API keys and metering (`src/api-keys/`, `src/metering/`, migration `0003`), the JSON API (`src/api/`), the remote MCP server (`src/mcp/`), admin views (`src/admin/`), the Claude Code pack (`.claude/`), their tests and the Full-only guides (billing, API keys and metering, MCP, admin, Claude Code pack).

Full is a superset: every Lite feature works the same way in Full, on the same core migration (`0001`).

## Markers in the Full edition

A few shared files contain comments such as `// @full-only-start` and `// @full-only-end` (or the `{/* */}`, `<!-- -->` and `#` forms). The lines between them are what Lite leaves out: route mounting in `src/app.tsx`, Stripe settings in `src/env.ts` and `.dev.vars.example`, the cron cleanup in `src/index.ts`, the billing and API links in `src/ui/layout.tsx`, the plan on the dashboard, and some documentation. They do nothing at runtime; keep or delete them.

## Upgrading from Lite to Full

Copy your own changes onto the Full tree (or the Full files onto your Lite project): the shared files have the same structure, and the Full-only code sits in its own folders. Then run `npm install`, `npm run db:migrate:local` (it applies the Full migrations after `0001`), and `npm run check`.
