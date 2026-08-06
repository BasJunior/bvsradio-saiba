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

/** Public absolute logo URL for HTML email clients. */
export function bvsEmailLogoUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com").replace(/\/$/, "");
  return `${base}/branding/bvs-logo.png`;
}

export function wrapBvsEmailHtml(opts: {
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const logo = bvsEmailLogoUrl();
  const footer =
    opts.footerNote ||
    "BVS Radio (Best Virtual Sound) · bvsradio.com · contact@bvsradio.com";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141414;border:1px solid #333;border-radius:16px;overflow:hidden">
        <tr><td style="padding:24px 28px 8px;text-align:center;border-bottom:1px solid #2a2a2a">
          <img src="${logo}" alt="BVS Radio" width="72" height="72" style="display:inline-block;width:72px;height:72px;border-radius:16px;object-fit:contain;background:#000"/>
          <div style="margin-top:10px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#f5c518;font-weight:700">BVS Radio</div>
        </td></tr>
        <tr><td style="padding:24px 28px 8px">
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#fafafa">${opts.title}</h1>
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:8px 28px 28px">
          <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#777">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendBvsEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
    replyTo: opts.replyTo || user,
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
  const bodyHtml = `
    <p style="color:#cfcfcf;line-height:1.5;margin:0 0 16px">Thanks for joining. Tap the button below to confirm <strong>${params.email}</strong>.</p>
    <p style="margin:28px 0"><a href="${params.confirmUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Confirm email</a></p>
    <p style="color:#999;font-size:13px;line-height:1.5">Or paste this link into your browser:<br/><a href="${params.confirmUrl}" style="color:#f5c518;word-break:break-all">${params.confirmUrl}</a></p>
    <p style="color:#777;font-size:12px;margin-top:24px">This link should open on bvsradio.com, not localhost. Open it in a full browser tab (not an email preview).</p>`;
  const html = wrapBvsEmailHtml({ title: "Confirm your BVS Radio account", bodyHtml });
  return { subject, text, html };
}
