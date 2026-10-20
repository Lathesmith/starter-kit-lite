import { env, SELF } from "cloudflare:test";
import type { AppEnv } from "../src/env";

export const ORIGIN = "http://localhost:8787";

export const testEnv = env as unknown as AppEnv;

/** A form POST the way a browser sends it, including the Origin header the CSRF check requires. */
export function formPost(
  path: string,
  fields: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  const body = new URLSearchParams(fields);
  return SELF.fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body,
    redirect: "manual",
  });
}

export function get(
  path: string,
  cookie?: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${path}`, {
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
    redirect: "manual",
  });
}

/** Extract `name=value` for the session cookie from a Set-Cookie header. */
export function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const first = raw.split(";")[0] ?? "";
  if (!first.includes("=")) throw new Error(`No cookie in response: ${raw}`);
  return first;
}

/** Pull the most recent magic-link token sent to an address out of the local outbox. */
export async function latestMagicToken(email: string): Promise<string> {
  const row = await testEnv.DB.prepare(
    // rowid preserves insertion order even when two emails share the same second.
    `SELECT text_body FROM email_log WHERE to_email = ? ORDER BY rowid DESC LIMIT 1`,
  )
    .bind(email)
    .first<{ text_body: string }>();
  if (!row) throw new Error(`No email sent to ${email}`);
  const match = row.text_body.match(/token=([A-Za-z0-9_\-%]+)/);
  if (!match?.[1]) throw new Error("No token in email body");
  return decodeURIComponent(match[1]);
}

/** Full sign-in flow through HTTP; returns the session cookie to send on later requests. */
export async function signIn(email: string): Promise<{ cookie: string }> {
  const sent = await formPost("/login", { email, next: "/dashboard" });
  if (sent.status !== 303) throw new Error(`login POST returned ${sent.status}`);
  const token = await latestMagicToken(email);
  const verified = await formPost("/auth/verify", { token, next: "/dashboard" });
  if (verified.status !== 303) throw new Error(`verify POST returned ${verified.status}`);
  return { cookie: cookieFrom(verified) };
}

/** Insert `n` notes for a user in one statement (fast way to reach MAX_NOTES_PER_USER). */
export async function fillNotes(userId: string, n: number): Promise<void> {
  await testEnv.DB.prepare(
    `WITH RECURSIVE seq(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM seq WHERE i < ?1)
     INSERT INTO notes (id, user_id, title, body, created_at, updated_at)
     SELECT 'note_fill_' || ?2 || '_' || i, ?2, 'Note ' || i, '', 1, 1 FROM seq`,
  )
    .bind(n, userId)
    .run();
}

export async function userIdFor(email: string): Promise<string> {
  const row = await testEnv.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();
  if (!row) throw new Error(`No user ${email}`);
  return row.id;
}
