import { isProduction, type AppEnv } from "../../env";
import { Alert, Layout } from "../layout";

export function LoginPage({
  env,
  next,
  error,
}: {
  env: AppEnv;
  next: string;
  error?: string | undefined;
}) {
  return (
    <Layout env={env} title="Sign in">
      <section class="narrow">
        <h1>Sign in</h1>
        <p>
          Enter your email and we will send you a one-time sign-in link. No password to remember.
        </p>
        {error ? <Alert kind="error">{error}</Alert> : null}
        <form method="post" action="/login" class="stack">
          <label for="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            maxlength={254}
            placeholder="you@example.com"
          />
          <input type="hidden" name="next" value={next} />
          <button type="submit" class="button">
            Email me a sign-in link
          </button>
        </form>
        {!isProduction(env) && !env.RESEND_API_KEY ? (
          <p class="muted">
            Development mode: no email provider is configured, so the link will appear in the{" "}
            <a href="/dev/outbox">local outbox</a>.
          </p>
        ) : null}
      </section>
    </Layout>
  );
}

export function LoginSentPage({ env }: { env: AppEnv }) {
  return (
    <Layout env={env} title="Check your email">
      <section class="narrow">
        <h1>Check your email</h1>
        <p>
          If that address is valid, a sign-in link is on its way. It expires in 15 minutes and works
          once.
        </p>
        {!isProduction(env) && !env.RESEND_API_KEY ? (
          <p>
            <a href="/dev/outbox" class="button">
              Open the local outbox
            </a>
          </p>
        ) : null}
      </section>
    </Layout>
  );
}

export function VerifyPage({ env, token, next }: { env: AppEnv; token: string; next: string }) {
  return (
    <Layout env={env} title="Confirm sign-in">
      <section class="narrow">
        <h1>Confirm sign-in</h1>
        <p>Click the button to finish signing in to {env.APP_NAME}.</p>
        <form method="post" action="/auth/verify">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" class="button">
            Sign in
          </button>
        </form>
      </section>
    </Layout>
  );
}
