import type { AppEnv, User } from "../../env";
import { Layout } from "../layout";

export function LandingPage({ env, user }: { env: AppEnv; user?: User | undefined }) {
  return (
    <Layout
      env={env}
      title={env.APP_NAME}
      user={user}
      description="A small, fast SaaS built on Cloudflare Workers and D1."
    >
      <section class="hero">
        <h1>{env.APP_NAME}</h1>
        <p class="lede">
          Replace this landing page with your product. Everything behind it already works: sign-in
          by email, a dashboard, a database, tests and deployment.
        </p>
        <p>
          <a href={user ? "/dashboard" : "/login"} class="button">
            {user ? "Go to your dashboard" : "Get started"}
          </a>
        </p>
      </section>
      <section class="features">
        <div>
          <h2>Fast by default</h2>
          <p>
            Server-rendered pages served from Cloudflare's edge. No client-side framework to load.
          </p>
        </div>
        <div>
          <h2>Simple accounts</h2>
          <p>Magic-link sign-in with secure, server-side sessions. No passwords to leak.</p>
        </div>
        <div>
          <h2>Ready for agents</h2>
          <p>A CLAUDE.md, skills and hooks so an AI coding agent can extend the app safely.</p>
        </div>
      </section>
    </Layout>
  );
}

export function PrivacyPage({ env, user }: { env: AppEnv; user?: User | undefined }) {
  return (
    <Layout env={env} title="Privacy policy" user={user}>
      <article class="prose">
        <h1>Privacy policy</h1>
        <p>
          <em>Template. Replace the bracketed parts and have it reviewed before you launch.</em>
        </p>
        <h2>What we collect</h2>
        <p>
          Your email address (to sign you in and to send account emails), the content you create in
          the app, and standard server logs. We do not use advertising trackers.
        </p>
        <h2>Payments</h2>
        <p>
          Payments are processed by Stripe on Stripe-hosted pages. We never see or store your card
          details. See Stripe's privacy policy for how they handle payment data.
        </p>
        <h2>Email</h2>
        <p>Transactional emails (sign-in links, receipts) are sent through [email provider].</p>
        <h2>Your rights</h2>
        <p>
          You can export or delete your account data by emailing [support email]. We answer within
          [N] days.
        </p>
        <h2>Contact</h2>
        <p>[Legal name or brand], [address], [support email].</p>
      </article>
    </Layout>
  );
}

export function TermsPage({ env, user }: { env: AppEnv; user?: User | undefined }) {
  return (
    <Layout env={env} title="Terms of service" user={user}>
      <article class="prose">
        <h1>Terms of service</h1>
        <p>
          <em>Template. Replace the bracketed parts and have it reviewed before you launch.</em>
        </p>
        <h2>The service</h2>
        <p>[Brand] provides [one-sentence description]. You must be 18 or older to use it.</p>
        <h2>Billing</h2>
        <p>
          Prices, what is included, and renewal terms are shown before checkout. Subscriptions renew
          automatically until cancelled; you can cancel at any time from the billing page and keep
          access until the end of the paid period. Refund policy: [your policy].
        </p>
        <h2>Acceptable use</h2>
        <p>No illegal content, no abuse of the API or rate limits, no reselling access.</p>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; material changes are announced by email. Contact: [support
          email].
        </p>
      </article>
    </Layout>
  );
}
