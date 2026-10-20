import { isProduction, type AppEnv } from "../env";
import { newId } from "../lib/crypto";
import { run, all } from "../lib/db";
import { now } from "../lib/time";
import { misconfigured } from "../lib/errors";
import { sendViaResend, type OutgoingEmail } from "./resend";

export interface EmailLogRow {
  id: string;
  to_email: string;
  subject: string;
  text_body: string;
  provider: "resend" | "outbox";
  provider_id: string | null;
  status: "sent" | "queued" | "failed";
  error: string | null;
  created_at: number;
}

/**
 * Send an email and record it in `email_log`.
 *
 * - With RESEND_API_KEY set: delivered through Resend.
 * - Without it, outside production: written to the local outbox (`email_log`) only. Read it at
 *   /dev/outbox or with `wrangler d1 execute DB --local --command "select * from email_log"`.
 * - Without it, in production: throws, because silently dropping sign-in links is worse.
 *
 * Delivered emails are logged with one-time tokens redacted (`redactForLog`): the log must not
 * hold live sign-in links that anyone with database access could use. Only the local outbox,
 * which never exists in production, keeps the full text, because it is how you sign in locally.
 */
export async function sendEmail(env: AppEnv, msg: OutgoingEmail): Promise<EmailLogRow> {
  const id = newId("eml");
  const ts = now();
  const apiKey = env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (isProduction(env)) {
      throw misconfigured("RESEND_API_KEY is not set; cannot send email in production");
    }
    await run(
      env.DB,
      `INSERT INTO email_log (id, to_email, subject, text_body, provider, provider_id, status, error, created_at)
       VALUES (?, ?, ?, ?, 'outbox', NULL, 'queued', NULL, ?)`,
      id,
      msg.to,
      msg.subject,
      msg.text,
      ts,
    );
    if (env.APP_ENV === "development") {
      console.log(`[mail:outbox] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    }
    return {
      id,
      to_email: msg.to,
      subject: msg.subject,
      text_body: msg.text,
      provider: "outbox",
      provider_id: null,
      status: "queued",
      error: null,
      created_at: ts,
    };
  }

  try {
    const { id: providerId } = await sendViaResend(apiKey, env.EMAIL_FROM, msg);
    await run(
      env.DB,
      `INSERT INTO email_log (id, to_email, subject, text_body, provider, provider_id, status, error, created_at)
       VALUES (?, ?, ?, ?, 'resend', ?, 'sent', NULL, ?)`,
      id,
      msg.to,
      msg.subject,
      redactForLog(msg.text),
      providerId,
      ts,
    );
    return {
      id,
      to_email: msg.to,
      subject: msg.subject,
      text_body: redactForLog(msg.text),
      provider: "resend",
      provider_id: providerId,
      status: "sent",
      error: null,
      created_at: ts,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await run(
      env.DB,
      `INSERT INTO email_log (id, to_email, subject, text_body, provider, provider_id, status, error, created_at)
       VALUES (?, ?, ?, ?, 'resend', NULL, 'failed', ?, ?)`,
      id,
      msg.to,
      msg.subject,
      redactForLog(msg.text),
      error,
      ts,
    );
    throw err;
  }
}

/** Strip one-time credentials (`?token=...`, `&code=...`) from text before it is stored. */
export function redactForLog(text: string): string {
  return text.replace(/([?&](?:token|code|key|secret)=)[^&\s]+/gi, "$1[redacted]");
}

export function recentEmails(env: AppEnv, limit = 20): Promise<EmailLogRow[]> {
  return all<EmailLogRow>(env.DB, `SELECT * FROM email_log ORDER BY rowid DESC LIMIT ?`, limit);
}
