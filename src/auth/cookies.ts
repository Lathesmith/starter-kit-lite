import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext, AppEnv } from "../env";
import { isProduction } from "../env";
import { DAY } from "../lib/time";

export const SESSION_TTL_SECONDS = 30 * DAY;

/**
 * In production the cookie uses the `__Host-` prefix, which browsers only accept when the cookie
 * is Secure, has Path=/ and no Domain: that pins it to this exact origin. Local `wrangler dev`
 * serves plain http, so development and tests use an unprefixed, non-Secure cookie.
 */
export function sessionCookieName(env: AppEnv): string {
  return isProduction(env) ? "__Host-session" : "session";
}

/** Secure in production, and on any HTTPS request even if APP_ENV is misconfigured. */
function secureCookie(c: Context<AppContext>): boolean {
  return isProduction(c.env) || new URL(c.req.url).protocol === "https:";
}

export function setSessionCookie(c: Context<AppContext>, token: string): void {
  setCookie(c, sessionCookieName(c.env), token, {
    httpOnly: true,
    secure: secureCookie(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function readSessionCookie(c: Context<AppContext>): string | undefined {
  return getCookie(c, sessionCookieName(c.env));
}

export function clearSessionCookie(c: Context<AppContext>): void {
  deleteCookie(c, sessionCookieName(c.env), {
    path: "/",
    secure: secureCookie(c),
  });
}
