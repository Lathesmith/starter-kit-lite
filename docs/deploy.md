# Deploying to Cloudflare

Target: Cloudflare Workers Free plan with a D1 database. First deploy by hand from your machine, then let GitHub Actions deploy on tags.

## 1. One-time Cloudflare setup

1. Create a Cloudflare account and note the **Account ID** (dashboard sidebar).
2. `npx wrangler login` (opens a browser), then create the database:
   ```
   npx wrangler d1 create starter-kit-db
   ```
   Paste the printed `database_id` into `wrangler.jsonc` under `d1_databases`.
3. Set production variables in `wrangler.jsonc` `vars` (or in an `env.production` block if you keep several environments):
   - `APP_ENV`: `production` (enables `Secure`/`__Host-` cookies and disables `/dev/*`)
   - `APP_URL`: `https://<name>.<account>.workers.dev` or your custom domain
   - `APP_NAME`, `EMAIL_FROM`, `ADMIN_EMAILS`
4. Set secrets (each prompts for the value; nothing is written to disk):
   ```
   npx wrangler secret put RESEND_API_KEY
   ```
5. Optional: uncomment `triggers.crons` in `wrangler.jsonc` for the daily cleanup.

## 2. First deploy by hand

```
npm run check
npm run db:migrate:remote
npm run deploy
```

Verify: `curl https://<worker>/health` returns `{"ok":true,"env":"production"}`. Sign in with a real email; the link arrives through Resend.

## 3. Continuous deployment from GitHub

`.github/workflows/deploy.yml` runs on every tag matching `v*`:

1. `npm ci`, typecheck, tests;
2. `wrangler d1 migrations apply DB --remote`;
3. `wrangler deploy`.

Repository secrets (Settings > Secrets and variables > Actions):

| Secret                  | How to get it                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Dashboard > My Profile > API Tokens > Create Token > "Edit Cloudflare Workers" template, then add **D1: Edit**. Scope it to one account. |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard sidebar                                                                                                                        |

App secrets (Resend, Stripe) are **not** GitHub secrets; they are Worker secrets set once in step 1 and survive deploys.

Release:

```
git tag v0.1.0
git push origin v0.1.0
```

The workflow uses a `production` environment; add required reviewers there if you want a manual gate. `.github/workflows/ci.yml` runs the checks and the edition build on every push and pull request.

## 4. Custom domain

Workers > your worker > Settings > Domains & Routes > add a custom domain on a zone in your account. Update `APP_URL`, Resend's sending domain, and the Stripe webhook URL if it changes.

## 5. Operations

- **Logs:** `npx wrangler tail` streams live logs; `observability.enabled` in `wrangler.jsonc` keeps them in the dashboard.
- **Rollback:** `npx wrangler rollback` returns to the previous deployment. Migrations are forward-only; write a new one to undo a schema change.
- **Database access:** `npx wrangler d1 execute DB --remote --command "select count(*) from users"`.
- **Secrets rotation:** see the `rotate-secret` skill or `docs/security.md`.

## 6. What is verified only after you deploy

Local tests and `wrangler dev` cover the application logic and the Workers runtime. The following can only be confirmed against real accounts: Resend delivery and DNS, Stripe's hosted pages and live webhook deliveries, the Cloudflare API token's permissions in CI, custom-domain routing, and real free-plan limits. `docs/testing.md` lists what the test suite covers locally.
