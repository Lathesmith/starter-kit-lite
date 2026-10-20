/**
 * Resend transport. One `fetch` call; no SDK needed on Workers.
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendViaResend(
  apiKey: string,
  from: string,
  msg: OutgoingEmail,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  return { id: data.id ?? "" };
}
