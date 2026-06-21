"use node";

export interface EmailPayload {
  to: string[];
  subject: string;
  text: string;
}

/**
 * Sends an email via Resend HTTP API.
 * If RESEND_API_KEY is not set, logs the email content (dev mode).
 * Never throws — failed sends are logged but swallowed.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRANSACTIONAL_FROM_EMAIL ?? "noreply@notifications.opencal.xyz";

  if (!apiKey) {
    console.log("[EMAIL DEV MODE] Would send email:");
    console.log(`  To: ${payload.to.join(", ")}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body: ${payload.text}`);
    return true;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[EMAIL ERROR] Resend API returned ${response.status}: ${errorBody}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL ERROR] Failed to send email:", error);
    return false;
  }
}
