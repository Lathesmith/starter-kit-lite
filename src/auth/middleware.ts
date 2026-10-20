import type { MiddlewareHandler } from "hono";
import { isProduction, type AppContext } from "../env";
import { forbidden, unauthorized } from "../lib/errors";
import { readSessionCookie, clearSessionCookie } from "./cookies";
import { resolveSession } from "./service";

/** Loads the current user from the session cookie, if any. Never blocks. */
export const attachSession: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = readSessionCookie(c);
  if (token) {
    const resolved = await resolveSession(c.env, token);
    if (resolved) {
      c.set("user", resolved.user);
      c.set("session", resolved.session);
    } else {
      clearSessionCookie(c);
    }
  }
  await next();
};

/** HTML routes: redirect anonymous visitors to the login page, remembering where they were going. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  if (!c.get("user")) return c.redirect(loginRedirect(c.req.url), 302);
  await next();
};

/** `/login?next=...` for the page being requested, query string included, validated as always. */
export function loginRedirect(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `/login?next=${encodeURIComponent(safeNextPath(url.pathname + url.search))}`;
}

/** JSON routes: 401 instead of a redirect. */
export const requireUserJson: MiddlewareHandler<AppContext> = async (c, next) => {
  if (!c.get("user")) throw unauthorized();
  await next();
};

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const user = c.get("user");
  if (!user) return c.redirect(loginRedirect(c.req.url), 302);
  if (user.role !== "admin") throw forbidden("Admin access required");
  await next();
};

/**
 * Only allow a path for local development and tests (dev outbox, debugging helpers).
 * Two independent conditions, so one config mistake cannot expose it: APP_ENV must be
 * "development" or "test" (see isProduction), AND the request must be addressed to a loopback
 * host. A deployed Worker is never reached as localhost, so a deploy that still has the default
 * APP_ENV=development does not publish everyone's sign-in links at /dev/outbox.
 */
export const devOnly: MiddlewareHandler<AppContext> = async (c, next) => {
  if (isProduction(c.env) || !isLoopbackHost(new URL(c.req.url).hostname)) return c.notFound();
  await next();
};

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(h)
  );
}

/**
 * Safe redirect target: same-origin paths only.
 * Browsers strip tabs/newlines from URLs, so "/\t/evil.com" would become "//evil.com";
 * reject control characters and backslashes, then confirm the URL resolves to our origin.
 * Dot-segment normalisation can turn "/.//evil.com" into "//evil.com", so the
 * normalised output is validated again before it is returned.
 */
export const DEFAULT_NEXT_PATH = "/dashboard";

export function safeNextPath(input: string | undefined, fallback = DEFAULT_NEXT_PATH): string {
  if (!input) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  try {
    const url = new URL(input, "https://app.invalid");
    if (url.origin !== "https://app.invalid") return fallback;
    const out = url.pathname + url.search + url.hash;
    if (!out.startsWith("/") || out.startsWith("//") || out.includes("\\")) return fallback;
    return out;
  } catch {
    return fallback;
  }
}
