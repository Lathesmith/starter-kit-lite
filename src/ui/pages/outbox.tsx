import type { AppEnv, User } from "../../env";
import type { EmailLogRow } from "../../email/mailer";
import { formatDate } from "../../lib/time";
import { Layout } from "../layout";

/** Turns bare URLs in a plain-text email into links, keeping everything else escaped. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return <>{parts.map((part) => (/^https?:\/\//.test(part) ? <a href={part}>{part}</a> : part))}</>;
}

export function OutboxPage({
  env,
  user,
  emails,
}: {
  env: AppEnv;
  user?: User | undefined;
  emails: EmailLogRow[];
}) {
  return (
    <Layout env={env} title="Local outbox" user={user}>
      <h1>Local email outbox</h1>
      <p class="muted">
        Development only. Emails land here when <code>RESEND_API_KEY</code> is not set. This page
        returns 404 in production.
      </p>
      {emails.length === 0 ? (
        <p>
          No emails yet. Request a sign-in link from the <a href="/login">login page</a>.
        </p>
      ) : (
        <ul class="list">
          {emails.map((e) => (
            <li class="card">
              <div class="row">
                <strong>{e.subject}</strong>
                <span class="muted small">
                  {e.provider}/{e.status} · {formatDate(e.created_at)}
                </span>
              </div>
              <p class="muted small">To: {e.to_email}</p>
              <p class="pre">
                <Linkify text={e.text_body} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
