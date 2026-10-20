# Quick start

From a fresh clone to a running app in about five minutes, with no cloud accounts. Everything below was exercised on Windows 10 (PowerShell and Git Bash) with Node 26; the commands are the same on macOS and Linux unless a platform note says otherwise.

## 1. Prerequisites

- **Node.js 20 or newer** (`node --version`). Node 22 LTS is the safe choice; the kit is also tested on Node 26.
- **git**.
- Nothing else. Cloudflare's `wrangler` and the local Workers runtime (`workerd`) install with `npm install`. You do not need a Cloudflare account to run locally.

## 2. Install

```
npm install
```

What happens: dependencies install, two packages (`esbuild`, `workerd`) run their install scripts to download platform binaries, and `wrangler types` generates `worker-configuration.d.ts` (git-ignored).

Platform notes:

- **npm 12 (ships with Node 26)** blocks install scripts unless approved. `package.json` already approves `esbuild` and `workerd` in `allowScripts`. If npm still warns that scripts were blocked, run `npm install-scripts approve --no-allow-scripts-pin esbuild workerd` and then `npm install` again.
- **Windows**: if `workerd` fails to start later with a DLL error, install the "Microsoft Visual C++ Redistributable" (x64). Long path support is not required.
- **Corporate proxies**: the install downloads `workerd` from GitHub releases; set `HTTPS_PROXY` if needed.

## 3. Local configuration

Copy the example secrets file. It is git-ignored; every value may stay empty for local development.

```
# Windows (cmd)
copy .dev.vars.example .dev.vars
# Windows (PowerShell)
Copy-Item .dev.vars.example .dev.vars
# macOS / Linux
cp .dev.vars.example .dev.vars
```

Non-secret settings (`APP_NAME`, `APP_URL`, `EMAIL_FROM`, `ADMIN_EMAILS`) live under `vars` in `wrangler.jsonc`. Put your own email in `ADMIN_EMAILS` if you want the admin role locally.

## 4. Create the local database

```
npm run db:migrate:local
```

This applies every file in `migrations/` to a local SQLite-backed D1 under `.wrangler/state/`. Re-run it whenever you add a migration. `npm run db:reset:local` wipes and reapplies.

## 5. Run

```
npm run dev
```

Open http://localhost:8787.

1. Click **Sign in**, enter any email address, submit.
2. There is no email provider configured, so the message is written to the local outbox. Open http://localhost:8787/dev/outbox and click the sign-in link.
3. Press **Sign in** on the confirmation page. You are on the dashboard; create a note.

Stop the server with Ctrl+C.

## 6. Run the checks

```
npm run typecheck
npm test
npm run check        # everything CI runs
```

Tests run inside the real Workers runtime with a fresh D1 database per test file; the first run takes about 20 seconds while the runtime starts.

## 7. Next steps

- Read `docs/architecture.md` (10 minutes) before changing anything.
- Replace the demo resource: `docs/add-a-feature.md`.
- Send real email: `docs/email.md`.
- Deploy: `docs/deploy.md`.

## Troubleshooting

| Symptom                                                                        | Cause and fix                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Address already in use` on 8787                                               | Another `wrangler dev` is running. Stop it, or `npm run dev -- --port 8788` and update `APP_URL` in `wrangler.jsonc` for the session.                                         |
| `This Worker requires compatibility date ... newest date supported ... is ...` | Your installed runtime is older than `compatibility_date` in `wrangler.jsonc`. Lower the date to the one in the message (never raise it to fix tests).                        |
| Tests print nothing and never finish                                           | The runtime failed to start. Run `npx vitest run tests/unit.test.ts --reporter=verbose` to see the error; it is usually the compatibility date above.                         |
| `D1_ERROR: no such table`                                                      | Migrations not applied: `npm run db:migrate:local`.                                                                                                                           |
| Sign-in link says invalid or expired                                           | Links last 15 minutes and work once. Request a new one; the newest is at the top of `/dev/outbox`.                                                                            |
| 403 on a form submit from curl                                                 | The CSRF check needs an `Origin: http://localhost:8787` header, as browsers send automatically.                                                                               |
| `npm audit` reports vulnerabilities                                            | They are in development tooling (wrangler/miniflare's transitive `sharp` and `undici`), which never ships inside the Worker. Update when Cloudflare publishes fixed versions. |
| Windows Defender slows `npm install`                                           | Exclude the project's `node_modules` folder from real-time scanning.                                                                                                          |
