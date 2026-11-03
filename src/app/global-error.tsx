"use client";

// This replaces the root layout, so it must work without providers or its CSS.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "15vh 24px" }}>
          <p style={{ color: "#d4af37", letterSpacing: ".2em", fontSize: 12, fontWeight: 700 }}>BVS RADIO</p>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", lineHeight: 1.1 }}>A brief interruption.</h1>
          <p style={{ color: "#bdbdbd", lineHeight: 1.7 }}>BVS couldn’t load this time. Try again to get back to the music.</p>
          <button type="button" onClick={retry} style={{ minHeight: 48, background: "#d4af37", color: "#09090b", border: 0, borderRadius: 28, padding: "12px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Try again</button>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 48, marginLeft: 12, background: "transparent", color: "#f5f5f5", border: "1px solid #666", borderRadius: 28, padding: "12px 24px", fontSize: 16, cursor: "pointer" }}>Reload BVS</button>
        </main>
      </body>
    </html>
  );
}
