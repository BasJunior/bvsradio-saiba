import { wrapBvsEmailHtml } from "@/lib/mailer";

type FirstUploadEmailInput = {
  displayName?: string | null;
  studioUrl?: string;
};

export function buildFirstUploadReactivationEmail(input: FirstUploadEmailInput = {}) {
  const studioUrl =
    input.studioUrl ||
    `${(process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com").replace(/\/$/, "")}/creator/studio#artist-upload`;
  const greeting = input.displayName?.trim()
    ? `Hi ${input.displayName.trim()},`
    : "Hi,";
  const subject = "Your BVS artist space is ready";
  const text = [
    greeting,
    "",
    "You joined BVS as an artist, but you have not sent us your first track yet.",
    "",
    "Your artist space is ready.",
    "",
    "Upload one track and BVS Editorial will review it. If approved, it can go live on BVS Radio — no Premium subscription required.",
    "",
    `Upload your first track: ${studioUrl}`,
    "",
    "Once you are live, Creator Studio will show your release status and listening activity.",
    "",
    "BVS Radio",
    "Best Virtual Sound",
  ].join("\n");

  const html = wrapBvsEmailHtml({
    title: "Your BVS artist space is ready",
    bodyHtml: `
      <p style="color:#cfcfcf;line-height:1.6;margin:0 0 16px">${greeting}</p>
      <p style="color:#cfcfcf;line-height:1.6;margin:0 0 16px">You joined BVS as an artist, but you have not sent us your first track yet.</p>
      <p style="color:#fafafa;line-height:1.6;margin:0 0 16px"><strong>Your artist space is ready.</strong></p>
      <p style="color:#cfcfcf;line-height:1.6;margin:0 0 16px">Upload one track and BVS Editorial will review it. If approved, it can go live on BVS Radio — <strong style="color:#fafafa">no Premium subscription required</strong>.</p>
      <p style="margin:28px 0"><a href="${studioUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Upload your first track</a></p>
      <p style="color:#999;font-size:13px;line-height:1.6;margin:0">Once you are live, Creator Studio will show your release status and listening activity.</p>`,
    footerNote: "BVS Radio · Best Virtual Sound · bvsradio.com",
  });

  return { subject, text, html, studioUrl };
}
