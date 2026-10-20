import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { ORIGIN, cookieFrom, formPost, get, latestMagicToken, signIn, testEnv } from "./helpers";

async function latestEmailText(email: string): Promise<string> {
  const row = await testEnv.DB.prepare(
    `SELECT text_body FROM email_log WHERE to_email = ? ORDER BY rowid DESC LIMIT 1`,
  )
    .bind(email)
    .first<{ text_body: string }>();
  return row?.text_body ?? "";
}

describe("magic-link sign-in", () => {
  it("sends a link to the outbox and signs the user in on confirmation", async () => {
    const sent = await formPost("/login", { email: "Alice@Example.com", next: "/dashboard" });
    expect(sent.status).toBe(303);
    expect(sent.headers.get("location")).toContain("/login/sent");

    // Email is lower-cased and the link is recorded in the local outbox.
    const token = await latestMagicToken("alice@example.com");
    expect(token.length).toBeGreaterThan(30);

    // GET shows a confirm form and does NOT consume the token.
    const page = await get(`/auth/verify?token=${encodeURIComponent(token)}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Confirm sign-in");

    const verified = await formPost("/auth/verify", { token, next: "/dashboard" });
    expect(verified.status).toBe(303);
    expect(verified.headers.get("location")).toBe("/dashboard");
    const setCookie = verified.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^session=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");

    const dash = await get("/dashboard", cookieFrom(verified));
    expect(dash.status).toBe(200);
    expect(await dash.text()).toContain("alice@example.com");
  });

  it("rejects a reused, forged or expired token", async () => {
    await formPost("/login", { email: "bob@example.com" });
    const token = await latestMagicToken("bob@example.com");

    const first = await formPost("/auth/verify", { token });
    expect(first.status).toBe(303);
    const second = await formPost("/auth/verify", { token });
    expect(second.status).toBe(401);

    const forged = await formPost("/auth/verify", { token: "not-a-real-token" });
    expect(forged.status).toBe(401);

    await formPost("/login", { email: "bob@example.com" });
    const token2 = await latestMagicToken("bob@example.com");
    const { sha256Hex } = await import("../src/lib/crypto");
    await testEnv.DB.prepare(`UPDATE magic_links SET expires_at = 1 WHERE id = ?`)
      .bind(await sha256Hex(token2))
      .run();
    const expired = await formPost("/auth/verify", { token: token2 });
    expect(expired.status).toBe(401);
  });

  it("rate limits sign-in link requests per address", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await formPost("/login", { email: "spam@example.com" });
      expect(res.status).toBe(303);
    }
    const sixth = await formPost("/login", { email: "spam@example.com" });
    expect(sixth.status).toBe(429);
  });

  it("applies the sign-in link limit atomically under concurrency", async () => {
    const email = "spam-race@example.com";
    const results = await Promise.all(
      Array.from({ length: 12 }, () => formPost("/login", { email })),
    );
    expect(results.filter((r) => r.status === 303)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(7);
    const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM magic_links WHERE email = ?`)
      .bind(email)
      .first<{ n: number }>();
    expect(row?.n).toBe(5);
  });

  it("rotates the session on sign-in: the browser's previous session is revoked", async () => {
    const first = await signIn("rotate-a@example.com");
    expect((await get("/dashboard", first.cookie)).status).toBe(200);
    // Same browser signs in again (any account): the old token must stop working.
    await formPost("/login", { email: "rotate-b@example.com" });
    const token = await latestMagicToken("rotate-b@example.com");
    const verified = await formPost("/auth/verify", { token, next: "/dashboard" }, first.cookie);
    expect(verified.status).toBe(303);
    expect((await get("/dashboard", first.cookie)).status).toBe(302);
    expect((await get("/dashboard", cookieFrom(verified))).status).toBe(200);
  });

  it("validates the email address", async () => {
    const res = await formPost("/login", { email: "nope" });
    expect(res.status).toBe(400);
  });

  it("blocks form posts without a matching Origin (CSRF)", async () => {
    const res = await SELF.fetch(`${ORIGIN}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: new URLSearchParams({ email: "x@example.com" }),
    });
    expect(res.status).toBe(403);
  });

  it("redirects anonymous users away from the dashboard and back after sign-in", async () => {
    const res = await get("/dashboard");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fdashboard");
    // The query string is part of where the user was going (regression: it used to be dropped).
    const withQuery = await get("/dashboard?tab=notes&page=2");
    expect(withQuery.headers.get("location")).toBe(
      `/login?next=${encodeURIComponent("/dashboard?tab=notes&page=2")}`,
    );
    const login = await get(withQuery.headers.get("location")!);
    expect(await login.text()).toContain('value="/dashboard?tab=notes&amp;page=2"');

    // Open redirects are refused at every step of the flow, not just in the helper.
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\t/evil.example",
      "/.//evil.example",
      "/a/..//evil.example",
      "/%2e//evil.example",
    ]) {
      const page = await get(`/login?next=${encodeURIComponent(bad)}`);
      expect(await page.text(), bad).toContain('value="/dashboard"');
    }
    await formPost("/login", { email: "redirect@example.com" });
    const token = await latestMagicToken("redirect@example.com");
    const verify = await get(
      `/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent("/\t/evil.example")}`,
    );
    expect(await verify.text()).toContain('value="/dashboard"');
    const landed = await formPost("/auth/verify", { token, next: "/.//evil.example" });
    expect(landed.status).toBe(303);
    expect(landed.headers.get("location")).toBe("/dashboard");

    // A legitimate deep link with query and fragment is preserved.
    await formPost("/login", { email: "deeplink@example.com" });
    const token2 = await latestMagicToken("deeplink@example.com");
    const deep = await formPost("/auth/verify", {
      token: token2,
      next: "/dashboard/billing?tab=plans#pro",
    });
    expect(deep.headers.get("location")).toBe("/dashboard/billing?tab=plans#pro");
  });

  it("carries a safe destination through the emailed link and the invalid-email form", async () => {
    // The destination survives the email round trip: link -> confirm page -> redirect.
    await formPost("/login", { email: "deep-email@example.com", next: "/dashboard/billing?x=1" });
    const link = await latestEmailText("deep-email@example.com");
    expect(link).toContain(`next=${encodeURIComponent("/dashboard/billing?x=1")}`);
    const url = new URL(link.match(/https?:\/\/\S+\/auth\/verify\?\S+/)![0]);
    const confirm = await get(url.pathname + url.search);
    expect(await confirm.text()).toContain('value="/dashboard/billing?x=1"');
    const landed = await formPost("/auth/verify", {
      token: url.searchParams.get("token")!,
      next: url.searchParams.get("next")!,
    });
    expect(landed.headers.get("location")).toBe("/dashboard/billing?x=1");

    // The default destination keeps the link short; hostile values never reach the email.
    await formPost("/login", { email: "plain-email@example.com", next: "/dashboard" });
    expect(await latestEmailText("plain-email@example.com")).not.toContain("next=");
    for (const bad of ["//evil.example", "https://evil.example", "/\t/evil.example"]) {
      await formPost("/login", { email: "hostile-email@example.com", next: bad });
      const text = await latestEmailText("hostile-email@example.com");
      expect(text, bad).not.toContain("next=");
      expect(text, bad).not.toContain("evil");
    }

    // A typo in the address keeps the (validated) destination on the re-rendered form.
    const typo = await formPost("/login", { email: "nope", next: "/dashboard/api-keys" });
    expect(typo.status).toBe(400);
    expect(await typo.text()).toContain('value="/dashboard/api-keys"');
    const hostile = await formPost("/login", { email: "nope", next: "//evil.example" });
    expect(await hostile.text()).toContain('value="/dashboard"');
  });

  it("signs out and invalidates the session server-side", async () => {
    const { cookie } = await signIn("carol@example.com");
    const out = await formPost("/logout", {}, cookie);
    expect(out.status).toBe(303);
    const after = await get("/dashboard", cookie);
    expect(after.status).toBe(302);
  });

  it("grants the admin role from ADMIN_EMAILS", async () => {
    await signIn("admin@example.com");
    const row = await testEnv.DB.prepare(
      `SELECT role FROM users WHERE email = 'admin@example.com'`,
    ).first<{
      role: string;
    }>();
    expect(row?.role).toBe("admin");
  });
});

describe("security headers", () => {
  it("sets CSP and friends on HTML responses", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://checkout.stripe.com");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("hides the dev outbox outside development", async () => {
    // Test env is APP_ENV=test, which is allowed; the production check is unit-tested via devOnly.
    const res = await get("/dev/outbox");
    expect(res.status).toBe(200);
  });
});
