import type { AppEnv, User } from "../../env";
import type { Note } from "../../notes/service";
import { formatDate } from "../../lib/time";
import { Alert, Layout } from "../layout";

export function DashboardPage({
  env,
  user,
  notes,
  error,
}: {
  env: AppEnv;
  user: User;
  notes: Note[];
  error?: string | undefined;
}) {
  return (
    <Layout env={env} title="Dashboard" user={user}>
      <h1>Dashboard</h1>
      <p class="muted">
        Signed in as <strong>{user.email}</strong>
      </p>

      <section class="card">
        <h2>New note</h2>
        {error ? <Alert kind="error">{error}</Alert> : null}
        <form method="post" action="/dashboard/notes" class="stack">
          <label for="title">Title</label>
          <input id="title" name="title" type="text" required maxlength={120} />
          <label for="body">Body</label>
          <textarea id="body" name="body" rows={4} maxlength={5000}></textarea>
          <button type="submit" class="button">
            Save note
          </button>
        </form>
      </section>

      <section>
        <h2>Your notes ({notes.length})</h2>
        {notes.length === 0 ? (
          <p class="muted">
            No notes yet. The form above creates one; the same data is available through the API and
            MCP server in the Full edition.
          </p>
        ) : (
          <ul class="list">
            {notes.map((n) => (
              <li class="card">
                <div class="row">
                  <strong>{n.title}</strong>
                  <form method="post" action={`/dashboard/notes/${n.id}/delete`} class="inline">
                    <button
                      type="submit"
                      class="link-button danger"
                      aria-label={`Delete note ${n.title}`}
                    >
                      Delete
                    </button>
                  </form>
                </div>
                {n.body ? <p class="pre">{n.body}</p> : null}
                <p class="muted small">{formatDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
