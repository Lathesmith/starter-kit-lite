# Authentication

Passwordless: the user enters an email, receives a one-time link, confirms, and gets a server-side session. No passwords are stored, so there is nothing to leak or reset.

## Flow

1. `POST /login` validates the email (zod, lower-cased), rate-limits to 5 links per address per 15 minutes, generates a 256-bit random token, stores `sha256(token)` with a 15-minute expiry in `magic_links`, and emails `APP_URL/auth/verify?token=...`.
2. `GET /auth/verify` shows a confirmation button. It does not consume the token, so email scanners and link previews that prefetch URLs cannot burn it.
3. `POST /auth/verify` consumes the token with a single conditional `UPDATE ... WHERE used_at IS NULL AND expires_at > now`; only one request can win, even under concurrent clicks. It upserts the user (admin role if the email is in `ADMIN_EMAILS`), creates a session (random token, `sha256` stored, 30-day expiry) and sets the cookie.
4. `attachSession` runs on every page request: it hashes the cookie token, loads session and user in one join, and touches `last_seen_at` at most hourly.
5. `POST /logout` deletes the session row and clears the cookie. Admins can revoke all of a user's sessions.

Redirect targets (`?next=`) pass through `safeNextPath`, which only allows same-origin paths: it rejects control characters, backslashes, protocol-relative and absolute URLs, and re-validates after URL normalisation so that dot segments cannot produce `//host`. The destination survives the whole flow: it is validated when the form is posted (and kept if the email address had a typo), added to the emailed link as `&next=` (left out when it is the default `/dashboard`), and validated again on the confirm page and on confirmation, so an edited link cannot become an open redirect.

## Cookie

| Attribute  | Value                                               | Why                                                                                                                                                                                                               |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name       | `__Host-session` in production, `session` otherwise | The `__Host-` prefix makes browsers refuse the cookie unless it is Secure, `Path=/` and has no `Domain`, pinning it to this exact origin. Local `wrangler dev` is plain http, so development uses the plain name. |
| `HttpOnly` | yes                                                 | Not readable from JavaScript.                                                                                                                                                                                     |
| `Secure`   | production                                          | Only sent over https.                                                                                                                                                                                             |
| `SameSite` | `Lax`                                               | Not sent on cross-site POSTs; top-level navigations still work.                                                                                                                                                   |
| `Max-Age`  | 30 days                                             | Matches the server-side expiry; the server-side row is authoritative.                                                                                                                                             |

## Why not an auth library?

The kit was planned around Better Auth (MIT, runs on Workers + D1). The reasons it ships a small implementation instead:

- **Fit for the buyer.** The kit's value is that a developer, or an agent, can read all of it in an afternoon. The auth code is about 200 lines with no ORM adapter, no CLI schema generation and no plugin system.
- **Surface area.** A library brings OAuth providers, organisations, two-factor flows and a large configuration space. Each is a place to misconfigure; none is needed for a small paid SaaS on day one.
- **Stability.** D1 support in auth libraries goes through Kysely or Drizzle adapters that change often. Plain SQL does not.
- **Security properties are the same.** Random tokens, hashed at rest, single-use links, same cookie flags, CSRF by Origin check. There is no custom cryptography.

## When to switch to Better Auth

Do it when you need social login (Google/GitHub), passkeys, organisations/teams or two-factor authentication. Steps:

1. `npm install better-auth` and a D1-compatible adapter (Kysely with `kysely-d1`, or Drizzle); generate its schema into a new migration.
2. Mount its handler at `/api/auth/*` in `src/app.tsx` (keep it outside the CSRF middleware's cookie routes only if the library performs its own origin checks; Better Auth does).
3. Replace `attachSession` with a middleware that calls the library's `getSession` and maps to the `User` shape in `src/env.ts`. Everything downstream (`requireUser`, pages, API keys) depends only on that shape.
4. Delete `src/auth/service.ts` and `magic_links`/`sessions` tables in a forward migration once users have re-authenticated.

## Configuration

| Setting                           | Where                                                        | Notes                                                                                                              |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ADMIN_EMAILS`                    | `vars` in `wrangler.jsonc`                                   | Comma-separated. Role is assigned at each sign-in, so removing an address demotes the user on their next login.    |
| `APP_URL`                         | `vars`                                                       | Used to build the link in the email. Must match the deployed origin.                                               |
| `RESEND_API_KEY`                  | secret                                                       | Empty in development: links go to `/dev/outbox`. Required in production (sign-in refuses to silently drop emails). |
| Link TTL, session TTL, rate limit | constants in `src/auth/service.ts` and `src/auth/cookies.ts` |                                                                                                                    |

## What is not included

Password login, OAuth, passkeys, two-factor, account deletion UI, email change. Each is a reasonable addition; `docs/add-a-feature.md` shows the pattern.
