import nodemailer from "nodemailer";

function required(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export function getMailFrom(): string {
  return (
    process.env.SMTP_FROM ||
    process.env.BVS_ORDER_EMAIL ||
    "BVS Radio <contact@bvsradio.com>"
  );
}

export async function sendBvsEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST || "smtp.ionos.de";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER || process.env.BVS_ORDER_EMAIL || "";
  const pass = process.env.SMTP_PASS || "";
  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    requireTLS: port === 587,
  });

  await transporter.sendMail({
    from: getMailFrom(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || opts.text.replace(/\n/g, "<br/>"),
    replyTo: user,
  });
}

export function buildConfirmEmail(params: {
  confirmUrl: string;
  email: string;
}): { subject: string; text: string; html: string } {
  const subject = "Confirm your BVS Radio account";
  const text = [
    "Welcome to BVS Radio.",
    "",
    "Confirm your email to finish creating your account:",
    params.confirmUrl,
    "",
    "This link opens on bvsradio.com. If it looks wrong or expired, request a new one from signup.",
    "",
    "If you did not sign up, ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #333;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:22px">Confirm your BVS Radio account</h1>
    <p style="color:#cfcfcf;line-height:1.5">Thanks for joining. Tap the button below to confirm <strong>${params.email}</strong>.</p>
    <p style="margin:28px 0"><a href="${params.confirmUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Confirm email</a></p>
    <p style="color:#999;font-size:13px;line-height:1.5">Or paste this link into your browser:<br/><a href="${params.confirmUrl}" style="color:#f5c518;word-break:break-all">${params.confirmUrl}</a></p>
    <p style="color:#777;font-size:12px;margin-top:24px">This link should open on bvsradio.com, not localhost. Open it in a full browser tab (not an email preview).</p>
  </div>
</body></html>`;
  return { subject, text, html };
}
