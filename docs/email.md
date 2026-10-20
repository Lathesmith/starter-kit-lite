# Transactional email

`sendEmail(env, message)` in `src/email/mailer.ts` is the only way the app sends mail. It records every attempt in `email_log` and uses one of two transports:

| `RESEND_API_KEY` | Environment       | Behaviour                                                                                                                      |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| unset            | development, test | Written to `email_log` as the **local outbox**; visible at `/dev/outbox`; printed to the `wrangler dev` console in development |
| unset            | production        | Throws `misconfigured`. Sign-in links must not be silently dropped                                                             |
| set              | any               | Sent through Resend's API with one `fetch`; the provider id is logged                                                          |

## Resend setup

1. Create a free Resend account (3,000 emails/month, 100/day at the time of writing).
2. Development: the sandbox sender `onboarding@resend.dev` can send to your own address. Put the API key in `.dev.vars` to try real delivery.
3. Production: add and verify your domain in Resend (DKIM, SPF, and return-path records at your DNS host; Cloudflare DNS makes this a two-minute job). Set `EMAIL_FROM` in `wrangler.jsonc` to an address on that domain, e.g. `My App <hello@myapp.com>`, and `npx wrangler secret put RESEND_API_KEY`.
4. Restrict the API key to "sending access" only.

If Resend is unavailable or you prefer another provider, replace `sendViaResend` in `src/email/resend.ts`; the rest of the app only depends on `sendEmail`.

## Templates

`src/email/templates.ts` holds `magicLinkEmail` and `planChangedEmail`. Each returns `{ to, subject, text, html }`. Keep a plain-text body (deliverability and accessibility) and escape every value you interpolate into HTML. The `add-email` skill has the step list.

## Compliance notes

These are transactional messages triggered by the recipient's own actions (sign-in, purchase). They do not need an unsubscribe link under CAN-SPAM, but they must not contain marketing. If you add newsletters or announcements, collect explicit consent, log it, and include a working unsubscribe link and a postal address in every message; this kit does not implement marketing email.
