import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { app } from "../src/app";
import type { AppEnv } from "../src/env";
import { isLoopbackHost, safeNextPath } from "../src/auth/middleware";
import { sessionCookieName } from "../src/auth/cookies";
import { randomToken, sha256Hex, timingSafeEqual } from "../src/lib/crypto";
import { startOfMonth, startOfNextMonth } from "../src/lib/time";
import { requestMagicLink } from "../src/auth/service";

const base = env as unknown as AppEnv;

describe("crypto helpers", () => {
  it("produces url-safe random tokens with enough entropy", () => {
    const t = randomToken(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(t);
  });

  it("hashes deterministically and compares in constant time", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("redirect and cookie helpers", () => {
  it("only allows same-origin next paths (open-redirect hardening)", () => {
    // Normal paths survive, including query string and fragment; dot segments are normalised.
    expect(safeNextPath("/dashboard/billing")).toBe("/dashboard/billing");
    expect(safeNextPath("/settings?tab=billing#x")).toBe("/settings?tab=billing#x");
    expect(safeNextPath("/dashboard?tab=keys&x=1")).toBe("/dashboard?tab=keys&x=1");
    expect(safeNextPath("/dashboard#section")).toBe("/dashboard#section");
    expect(safeNextPath("/a/b?c=d#e")).toBe("/a/b?c=d#e");
    expect(safeNextPath("/a/./b")).toBe("/a/b");
    expect(safeNextPath("/a/../b")).toBe("/b");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(undefined, "/x")).toBe("/x");
    expect(safeNextPath("", "/x")).toBe("/x");

    // Anything that could leave the origin falls back.
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("http://evil.example/path")).toBe("/dashboard");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("///evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath("\\\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("dashboard")).toBe("/dashboard");

    // Browsers strip tabs and newlines before parsing, so "/\t/evil" would become "//evil".
    expect(safeNextPath("/\t/evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\n/evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\r/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/dashboard\u0000")).toBe("/dashboard");
    expect(safeNextPath("/dash\u007fboard")).toBe("/dashboard");

    // Dot-segment normalisation must not be able to manufacture a protocol-relative URL.
    expect(safeNextPath("/.//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/a/..//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/%2e//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/%2E%2E//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/a/%2e%2e//evil.com")).toBe("/dashboard");
  });

  it("uses a __Host- cookie in production and a plain one elsewhere", () => {
    expect(sessionCookieName({ ...base, APP_ENV: "production" })).toBe("__Host-session");
    expect(sessionCookieName({ ...base, APP_ENV: "development" })).toBe("session");
  });

  it("computes the start of the UTC month", () => {
    expect(startOfMonth(Date.UTC(2026, 9, 15, 12) / 1000)).toBe(Date.UTC(2026, 9, 1) / 1000);
  });

  it("computes the start of the next UTC month from any day, including the 28th-31st", () => {
    // Regression: "now + 32 days" from January 31 is March 4, which skipped February.
    const s = (y: number, m: number, d: number, h = 23) => Date.UTC(y, m, d, h, 59) / 1000;
    expect(startOfNextMonth(s(2026, 0, 31))).toBe(Date.UTC(2026, 1, 1) / 1000);
    expect(startOfNextMonth(s(2026, 0, 28))).toBe(Date.UTC(2026, 1, 1) / 1000);
    expect(startOfNextMonth(s(2026, 2, 31))).toBe(Date.UTC(2026, 3, 1) / 1000);
    expect(startOfNextMonth(s(2028, 1, 29))).toBe(Date.UTC(2028, 2, 1) / 1000);
    expect(startOfNextMonth(s(2026, 11, 31))).toBe(Date.UTC(2027, 0, 1) / 1000);
    expect(startOfNextMonth(Date.UTC(2026, 9, 1) / 1000)).toBe(Date.UTC(2026, 10, 1) / 1000);
  });

  it("links the footer credit to the free Lite edition's repository", async () => {
    const html = await (await app.request("http://localhost:8787/", {}, base)).text();
    expect(html).toContain('href="https://github.com/Lathesmith/starter-kit-lite"');
  });
});

describe("production-mode behaviour (via app.request with a custom env)", () => {
  const prod: AppEnv = { ...base, APP_ENV: "production", APP_URL: "https://app.example.com" };

  it("hides the dev outbox", async () => {
    const res = await app.request("https://app.example.com/dev/outbox", {}, prod);
    expect(res.status).toBe(404);
  });

  it("fails closed when APP_ENV is left at development or mistyped on a deployed Worker", async () => {
    // Default wrangler.jsonc vars (APP_ENV=development) on a public hostname: the outbox, which
    // holds every sign-in link, must not be reachable.
    const devDeployed: AppEnv = { ...base, APP_ENV: "development" };
    const res = await app.request("https://app.example.workers.dev/dev/outbox", {}, devDeployed);
    expect(res.status).toBe(404);
    // An unknown APP_ENV value ("prod") is treated as production.
    const typo = { ...base, APP_ENV: "prod" } as unknown as AppEnv;
    expect(sessionCookieName(typo)).toBe("__Host-session");
    expect((await app.request("http://localhost/dev/outbox", {}, typo)).status).toBe(404);
    // Local development still gets the outbox.
    expect((await app.request("http://localhost:8787/dev/outbox", {}, devDeployed)).status).toBe(
      200,
    );
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost.evil.com")).toBe(false);
    expect(isLoopbackHost("127.0.0.1.nip.io")).toBe(false);
  });

  it("marks the session cookie Secure on HTTPS even when APP_ENV is not production", async () => {
    const devDeployed: AppEnv = { ...base, APP_ENV: "development" };
    const token = randomToken(32);
    const ts = Math.floor(Date.now() / 1000);
    await base.DB.prepare(
      `INSERT INTO magic_links (id, email, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)`,
    )
      .bind(await sha256Hex(token), "https-dev@example.com", ts, ts + 600)
      .run();
    const res = await app.request(
      "https://app.example.workers.dev/auth/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://app.example.workers.dev",
        },
        body: new URLSearchParams({ token, next: "/dashboard" }),
      },
      devDeployed,
    );
    expect(res.status).toBe(303);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
  });

  it("refuses to send email without a provider instead of silently dropping sign-in links", async () => {
    const res = await app.request(
      "https://app.example.com/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://app.example.com",
        },
        body: new URLSearchParams({ email: "prod@example.com" }),
      },
      prod,
    );
    expect(res.status).toBe(500);
  });

  it("sets Secure and __Host- cookie attributes on sign-in", async () => {
    const { createSession, upsertUserByEmail } = await import("../src/auth/service");
    const user = await upsertUserByEmail(prod, "cookie@example.com");
    const { token } = await createSession(prod, user.id);
    const res = await app.request(
      "https://app.example.com/dashboard",
      { headers: { Cookie: `__Host-session=${token}` } },
      prod,
    );
    expect(res.status).toBe(200);
    // Logging out clears the cookie with matching attributes.
    const out = await app.request(
      "https://app.example.com/logout",
      {
        method: "POST",
        headers: {
          Origin: "https://app.example.com",
          Cookie: `__Host-session=${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      },
      prod,
    );
    expect(out.status).toBe(303);
    const cleared = out.headers.get("set-cookie") ?? "";
    expect(cleared).toMatch(/^__Host-session=/);
    expect(cleared).toContain("Secure");
    expect(cleared).toContain("Max-Age=0");
  });

  it("does not store live sign-in links in the email log when delivering through a provider", async () => {
    const withResend: AppEnv = { ...prod, RESEND_API_KEY: "re_test_placeholder" };
    let sentBody = "";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    });
    try {
      await requestMagicLink(withResend, "logged@example.com");
    } finally {
      spy.mockRestore();
    }
    // The recipient gets the real link...
    expect(sentBody).toMatch(/token=[A-Za-z0-9_-]{20,}/);
    // ...but the stored copy cannot be used to sign in.
    const row = await base.DB.prepare(`SELECT text_body FROM email_log WHERE to_email = ?`)
      .bind("logged@example.com")
      .first<{ text_body: string }>();
    expect(row?.text_body).toContain("token=[redacted]");
    expect(row?.text_body).not.toMatch(/token=[A-Za-z0-9_-]{20,}/);
  });
});
