import { Hono } from "hono";
import type { AppContext } from "../env";
import { devOnly } from "../auth/middleware";
import { recentEmails } from "../email/mailer";
import { LandingPage, PrivacyPage, TermsPage } from "../ui/pages/marketing";
import { OutboxPage } from "../ui/pages/outbox";

export const marketingRoutes = new Hono<AppContext>();

marketingRoutes.get("/", (c) => c.html(<LandingPage env={c.env} user={c.get("user")} />));
marketingRoutes.get("/privacy", (c) => c.html(<PrivacyPage env={c.env} user={c.get("user")} />));
marketingRoutes.get("/terms", (c) => c.html(<TermsPage env={c.env} user={c.get("user")} />));
marketingRoutes.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

/** Development only: the local email outbox, so sign-in works without an email provider. */
marketingRoutes.get("/dev/outbox", devOnly, async (c) => {
  const emails = await recentEmails(c.env, 20);
  return c.html(<OutboxPage env={c.env} user={c.get("user")} emails={emails} />);
});
