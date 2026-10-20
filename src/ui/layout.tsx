import type { Child } from "hono/jsx";
import type { AppEnv, User } from "../env";

export interface LayoutProps {
  env: AppEnv;
  title: string;
  user?: User | undefined;
  /** Short description for the <meta name="description"> tag. */
  description?: string;
  children?: Child;
}

/**
 * The single page shell. Server-rendered, no client-side JavaScript required.
 * Styles live in public/style.css (served as a static asset, cached at the edge).
 */
export function Layout({ env, title, user, description, children }: LayoutProps) {
  const appName = env.APP_NAME;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title === appName ? appName : `${title} · ${appName}`}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="stylesheet" href="/style.css" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <a class="skip-link" href="#main">
          Skip to content
        </a>
        <header class="site-header">
          <nav aria-label="Primary">
            <a href="/" class="brand">
              {appName}
            </a>
            <ul>
              {user ? (
                <>
                  <li>
                    <a href="/dashboard">Dashboard</a>
                  </li>
                  <li>
                    <form method="post" action="/logout" class="inline">
                      <button type="submit" class="link-button">
                        Sign out
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <li>
                  <a href="/login" class="button">
                    Sign in
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </header>
        <main id="main" class="container">
          {children}
        </main>
        <footer class="site-footer">
          <p>
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
            <span>
              {appName} is built on the{" "}
              <a href="https://github.com/Lathesmith/starter-kit-lite" rel="noopener">
                Lathesmith starter kit
              </a>
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children?: Child;
}) {
  return (
    <div class={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
