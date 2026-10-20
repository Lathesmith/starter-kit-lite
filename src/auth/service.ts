/**
 * Passwordless authentication: magic links + opaque server-side sessions.
 *
 * Why not a library? See docs/auth.md. In short: this is ~200 lines, every line is auditable, it
 * needs no ORM adapter, and it is the easiest thing for an AI agent to extend safely. Swapping in
 * Better Auth later is documented there too.
 */
import type { AppEnv, Session, User } from "../env";
import { adminEmails } from "../env";
import { newId, randomToken, sha256Hex } from "../lib/crypto";
import { one, run } from "../lib/db";
import { tooManyRequests, unauthorized } from "../lib/errors";
import { MINUTE, now } from "../lib/time";
import { sendEmail } from "../email/mailer";
import { magicLinkEmail } from "../email/templates";
import { SESSION_TTL_SECONDS } from "./cookies";
import { DEFAULT_NEXT_PATH, safeNextPath } from "./middleware";

export const MAGIC_LINK_TTL_MINUTES = 15;
/** Max magic links per email address per window. Stops sign-in email bombing. */
const MAGIC_LINK_LIMIT = 5;
const MAGIC_LINK_WINDOW = 15 * MINUTE;

/**
 * Email a sign-in link. `next` is where the user lands after confirming; it is re-validated with
 * `safeNextPath` here and again when the link is opened and confirmed, so a crafted value can never
 * become an open redirect. The default destination is left out of the URL to keep it short.
 */
export async function requestMagicLink(env: AppEnv, email: string, next?: string): Promise<void> {
  const ts = now();
  const token = randomToken(32);
  const id = await sha256Hex(token);
  // Check and insert in one statement, so parallel requests cannot all pass the limit check.
  const inserted = await run(
    env.DB,
    `INSERT INTO magic_links (id, email, created_at, expires_at, used_at)
     SELECT ?1, ?2, ?3, ?4, NULL
     WHERE (SELECT COUNT(*) FROM magic_links WHERE email = ?2 AND created_at > ?5) < ?6`,
    id,
    email,
    ts,
    ts + MAGIC_LINK_TTL_MINUTES * MINUTE,
    ts - MAGIC_LINK_WINDOW,
    MAGIC_LINK_LIMIT,
  );
  if (inserted !== 1) {
    throw tooManyRequests("Too many sign-in links requested. Try again in a few minutes.");
  }

  const destination = safeNextPath(next);
  const url =
    `${env.APP_URL}/auth/verify?token=${encodeURIComponent(token)}` +
    (destination === DEFAULT_NEXT_PATH ? "" : `&next=${encodeURIComponent(destination)}`);
  await sendEmail(
    env,
    magicLinkEmail({ appName: env.APP_NAME, to: email, url, minutes: MAGIC_LINK_TTL_MINUTES }),
  );
}

/**
 * Consume a magic link. Single use is enforced by the conditional UPDATE: only the request that
 * flips `used_at` from NULL wins, even under concurrent clicks.
 */
export async function consumeMagicLink(env: AppEnv, token: string): Promise<string> {
  const id = await sha256Hex(token);
  const ts = now();
  const changed = await run(
    env.DB,
    `UPDATE magic_links SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
    ts,
    id,
    ts,
  );
  if (changed !== 1) throw unauthorized("This sign-in link is invalid, expired or already used.");
  const row = await one<{ email: string }>(
    env.DB,
    `SELECT email FROM magic_links WHERE id = ?`,
    id,
  );
  if (!row) throw unauthorized("This sign-in link is invalid.");
  return row.email;
}

/** Find or create the user for an email. Admin role comes from ADMIN_EMAILS. */
export async function upsertUserByEmail(env: AppEnv, email: string): Promise<User> {
  const ts = now();
  const role = adminEmails(env).has(email) ? "admin" : "user";
  await run(
    env.DB,
    `INSERT INTO users (id, email, role, plan, created_at, last_login_at)
     VALUES (?, ?, ?, 'free', ?, ?)
     ON CONFLICT(email) DO UPDATE SET last_login_at = excluded.last_login_at, role = excluded.role`,
    newId("usr"),
    email,
    role,
    ts,
    ts,
  );
  const user = await one<User>(env.DB, `SELECT * FROM users WHERE email = ?`, email);
  if (!user) throw new Error("User upsert failed");
  return user;
}

export async function createSession(
  env: AppEnv,
  userId: string,
  userAgent?: string,
): Promise<{ token: string; session: Session }> {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const ts = now();
  const session: Session = {
    id,
    user_id: userId,
    created_at: ts,
    expires_at: ts + SESSION_TTL_SECONDS,
    last_seen_at: ts,
  };
  await run(
    env.DB,
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    ts,
    session.expires_at,
    ts,
    userAgent?.slice(0, 200) ?? null,
  );
  return { token, session };
}

/** Resolve a cookie token to its session and user, or null. Touches `last_seen_at` hourly. */
export async function resolveSession(
  env: AppEnv,
  token: string,
): Promise<{ session: Session; user: User } | null> {
  const id = await sha256Hex(token);
  const ts = now();
  const row = await one<
    Session & {
      u_id: string;
      u_email: string;
      u_role: User["role"];
      u_plan: User["plan"];
      u_created_at: number;
      u_last_login_at: number | null;
    }
  >(
    env.DB,
    `SELECT s.id, s.user_id, s.created_at, s.expires_at, s.last_seen_at,
            u.id AS u_id, u.email AS u_email, u.role AS u_role, u.plan AS u_plan,
            u.created_at AS u_created_at, u.last_login_at AS u_last_login_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
    id,
    ts,
  );
  if (!row) return null;
  if (ts - row.last_seen_at > 3600) {
    await run(env.DB, `UPDATE sessions SET last_seen_at = ? WHERE id = ?`, ts, id);
  }
  return {
    session: {
      id: row.id,
      user_id: row.user_id,
      created_at: row.created_at,
      expires_at: row.expires_at,
      last_seen_at: row.last_seen_at,
    },
    user: {
      id: row.u_id,
      email: row.u_email,
      role: row.u_role,
      plan: row.u_plan,
      created_at: row.u_created_at,
      last_login_at: row.u_last_login_at,
    },
  };
}

export async function revokeSession(env: AppEnv, token: string): Promise<void> {
  const id = await sha256Hex(token);
  await run(env.DB, `DELETE FROM sessions WHERE id = ?`, id);
}

export async function revokeAllSessions(env: AppEnv, userId: string): Promise<number> {
  return run(env.DB, `DELETE FROM sessions WHERE user_id = ?`, userId);
}

/** Housekeeping, called from the cron trigger (src/index.ts). */
export async function purgeExpiredAuthRows(
  env: AppEnv,
): Promise<{ sessions: number; links: number }> {
  const ts = now();
  const sessions = await run(env.DB, `DELETE FROM sessions WHERE expires_at <= ?`, ts);
  const links = await run(env.DB, `DELETE FROM magic_links WHERE expires_at <= ?`, ts - 86400);
  return { sessions, links };
}
