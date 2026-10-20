/**
 * Environment bindings and typed configuration.
 *
 * Non-secret values come from `vars` in wrangler.jsonc. Secrets come from `.dev.vars` locally and
 * `wrangler secret put` in production. Everything optional here is optional on purpose: the app
 * boots with no secrets at all in development (emails go to the local outbox, billing is hidden).
 */
export interface AppEnv {
  DB: D1Database;
  ASSETS: Fetcher;

  APP_NAME: string;
  APP_URL: string;
  APP_ENV: "development" | "test" | "production";
  EMAIL_FROM: string;
  ADMIN_EMAILS: string;

  RESEND_API_KEY?: string;
}

export type Role = "user" | "admin";
export type Plan = "free" | "pro" | "lifetime";

export interface User {
  id: string;
  email: string;
  role: Role;
  plan: Plan;
  created_at: number;
  last_login_at: number | null;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

/** Variables set on the Hono context by middleware. */
export interface AppVariables {
  user?: User;
  session?: Session;
  apiKey?: ApiKey;
}

export type AppContext = { Bindings: AppEnv; Variables: AppVariables };

/**
 * Fails closed: anything other than exactly "development" or "test" (unset, a typo such as "prod")
 * gets production behaviour. Dev-only conveniences must not appear because of a config mistake.
 */
export function isProduction(env: AppEnv): boolean {
  return env.APP_ENV !== "development" && env.APP_ENV !== "test";
}

export function adminEmails(env: AppEnv): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
