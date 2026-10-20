import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../env";
import { emailSchema, parseOrThrow } from "../lib/validate";
import { AppError } from "../lib/errors";
import { setSessionCookie, clearSessionCookie, readSessionCookie } from "./cookies";
import { safeNextPath } from "./middleware";
import {
  consumeMagicLink,
  createSession,
  requestMagicLink,
  revokeSession,
  upsertUserByEmail,
} from "./service";
import { LoginPage, LoginSentPage, VerifyPage } from "../ui/pages/auth";

export const authRoutes = new Hono<AppContext>();

authRoutes.get("/login", (c) => {
  if (c.get("user")) return c.redirect("/dashboard", 302);
  const next = safeNextPath(c.req.query("next"));
  return c.html(<LoginPage env={c.env} next={next} error={c.req.query("error")} />);
});

authRoutes.post("/login", async (c) => {
  const form = await c.req.parseBody();
  // Validated once here and used on every path below: the error re-render, the link, the redirect.
  const next = safeNextPath(typeof form["next"] === "string" ? form["next"] : undefined);
  let email: string;
  try {
    ({ email } = parseOrThrow(z.object({ email: emailSchema }), form));
  } catch {
    return c.html(<LoginPage env={c.env} next={next} error="Enter a valid email address." />, 400);
  }
  try {
    await requestMagicLink(c.env, email, next);
  } catch (err) {
    if (err instanceof AppError && err.status === 429) {
      return c.html(<LoginPage env={c.env} next={next} error={err.message} />, 429);
    }
    throw err;
  }
  return c.redirect(`/login/sent?next=${encodeURIComponent(next)}`, 303);
});

authRoutes.get("/login/sent", (c) => c.html(<LoginSentPage env={c.env} />));

/**
 * The link in the email lands on a GET that shows a confirm button. Consuming the token on POST
 * means mail scanners and link previews that prefetch URLs cannot burn the one-time link.
 */
authRoutes.get("/auth/verify", (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.redirect("/login?error=missing", 302);
  return c.html(<VerifyPage env={c.env} token={token} next={safeNextPath(c.req.query("next"))} />);
});

authRoutes.post("/auth/verify", async (c) => {
  const form = await c.req.parseBody();
  const token = typeof form["token"] === "string" ? form["token"] : "";
  const next = safeNextPath(typeof form["next"] === "string" ? form["next"] : undefined);
  try {
    const email = await consumeMagicLink(c.env, token);
    const user = await upsertUserByEmail(c.env, email);
    // Rotate: a session this browser already had (possibly planted, or another account) ends here.
    const previous = readSessionCookie(c);
    if (previous) await revokeSession(c.env, previous);
    const { token: sessionToken } = await createSession(c.env, user.id, c.req.header("user-agent"));
    setSessionCookie(c, sessionToken);
    return c.redirect(next, 303);
  } catch (err) {
    if (err instanceof AppError && err.status === 401) {
      return c.html(<LoginPage env={c.env} next={next} error={err.message} />, 401);
    }
    throw err;
  }
});

authRoutes.post("/logout", async (c) => {
  const token = readSessionCookie(c);
  if (token) await revokeSession(c.env, token);
  clearSessionCookie(c);
  return c.redirect("/", 303);
});
