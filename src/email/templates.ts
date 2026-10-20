import type { OutgoingEmail } from "./resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(appName: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#111">
<p style="font-weight:600;font-size:18px">${escapeHtml(appName)}</p>
${bodyHtml}
<p style="color:#666;font-size:12px;margin-top:32px">You received this because an action was requested for this address on ${escapeHtml(appName)}. If it wasn't you, you can ignore this email.</p>
</body></html>`;
}

export function magicLinkEmail(opts: {
  appName: string;
  to: string;
  url: string;
  minutes: number;
}): OutgoingEmail {
  const { appName, to, url, minutes } = opts;
  return {
    to,
    subject: `Sign in to ${appName}`,
    text: `Click the link below to sign in to ${appName}. It expires in ${minutes} minutes and works once.\n\n${url}\n\nIf you didn't request this, ignore this email.`,
    html: wrap(
      appName,
      `<p>Click the button below to sign in. The link expires in ${minutes} minutes and works once.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Sign in to ${escapeHtml(appName)}</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(url)}</p>`,
    ),
  };
}

/** Sent when a plan goes UP (a purchase or subscription started). */
export function planChangedEmail(opts: {
  appName: string;
  to: string;
  planName: string;
  dashboardUrl: string;
}): OutgoingEmail {
  const { appName, to, planName, dashboardUrl } = opts;
  return {
    to,
    subject: `Your ${appName} plan is now ${planName}`,
    text: `Thanks! Your ${appName} account is now on the ${planName} plan.\n\nManage it here: ${dashboardUrl}`,
    html: wrap(
      appName,
      `<p>Thanks! Your account is now on the <strong>${escapeHtml(planName)}</strong> plan.</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open your dashboard</a></p>`,
    ),
  };
}

/**
 * Sent when a plan goes DOWN (subscription ended, refund). Neutral wording: no "thanks", and it
 * tells the user where to check, because a downgrade they did not expect is a support question.
 */
export function planDowngradedEmail(opts: {
  appName: string;
  to: string;
  planName: string;
  dashboardUrl: string;
}): OutgoingEmail {
  const { appName, to, planName, dashboardUrl } = opts;
  return {
    to,
    subject: `Your ${appName} plan has changed to ${planName}`,
    text: `Your ${appName} account has moved to the ${planName} plan. This happens when a subscription ends or a payment is refunded.

If you did not expect this, check your billing page: ${dashboardUrl}`,
    html: wrap(
      appName,
      `<p>Your account has moved to the <strong>${escapeHtml(planName)}</strong> plan. This happens when a subscription ends or a payment is refunded.</p>
<p>If you did not expect this, check your <a href="${escapeHtml(dashboardUrl)}">billing page</a>.</p>`,
    ),
  };
}
