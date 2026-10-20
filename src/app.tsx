import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AppContext } from "./env";
import { attachSession } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { AppError } from "./lib/errors";
import { marketingRoutes } from "./marketing/routes";
import { dashboardRoutes } from "./notes/routes";
import { ErrorPage } from "./ui/pages/errors";

/**
 * The HTTP app. Middleware order matters:
 *  1. security headers on every response;
 *  2. CSRF origin check for form posts (API and webhooks are excluded: they use bearer tokens and
 *     signatures, and never cookies);
 *  3. session loading from the cookie.
 */
export const app = new Hono<AppContext>();

app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],
      // Checkout posts redirect to Stripe-hosted pages; Chrome applies form-action to redirects.
      formAction: [
        "'self'",
        "https://checkout.stripe.com",
        "https://billing.stripe.com",
        "https://buy.stripe.com",
      ],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

const isMachineRoute = (path: string) =>
  path.startsWith("/api/") ||
  path.startsWith("/webhooks/") ||
  path === "/mcp" ||
  path.startsWith("/mcp/");

app.use("*", async (c, next) => {
  if (isMachineRoute(new URL(c.req.url).pathname)) return next();
  return csrf()(c, next);
});

app.use("*", async (c, next) => {
  if (isMachineRoute(new URL(c.req.url).pathname)) return next();
  return attachSession(c, next);
});

app.route("/", marketingRoutes);
app.route("/", authRoutes);
app.route("/", dashboardRoutes);

app.notFound((c) => {
  if (isMachineRoute(new URL(c.req.url).pathname)) {
    return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
  }
  return c.html(
    <ErrorPage env={c.env} user={c.get("user")} status={404} message="That page does not exist." />,
    404,
  );
});

app.onError((err, c) => {
  const machine = isMachineRoute(new URL(c.req.url).pathname);
  // Hono's own middleware (CSRF, body limits) signals with HTTPException; keep its status.
  if (err instanceof HTTPException) {
    if (machine)
      return c.json(
        { error: { code: "http_error", message: err.message || "Request refused" } },
        err.status,
      );
    return c.html(
      <ErrorPage
        env={c.env}
        user={c.get("user")}
        status={err.status}
        message={err.message || "The request was refused."}
      />,
      err.status,
    );
  }
  if (err instanceof AppError) {
    if (machine) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          },
        },
        err.status as 400,
      );
    }
    return c.html(
      <ErrorPage env={c.env} user={c.get("user")} status={err.status} message={err.message} />,
      err.status as 400,
    );
  }
  console.error("Unhandled error", err);
  if (machine) {
    return c.json({ error: { code: "internal", message: "Internal error" } }, 500);
  }
  return c.html(
    <ErrorPage
      env={c.env}
      user={c.get("user")}
      status={500}
      message="Something went wrong on our side. Please try again."
    />,
    500,
  );
});
