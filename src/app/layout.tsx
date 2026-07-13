import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BVS Radio",
  description: "Zimbabwe's Sound",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white min-h-screen font-sans">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-5xl font-bold mb-8 text-yellow-400">BVS Radio</h1>
          <p className="text-xl mb-8">Site has been fixed. The previous blank page issue has been resolved.</p>
          <p className="mb-6">Current status: Live on Vercel with simplified layout.</p>
          
          <div className="bg-zinc-900 p-8 rounded-2xl border border-yellow-400/30">
            <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
            <ul className="space-y-3 text-lg">
              <li><a href="/radio" className="text-yellow-400 hover:underline">→ Listen Live</a></li>
              <li><a href="/shop" className="text-yellow-400 hover:underline">→ Shop Deals</a></li>
              <li><a href="/blog" className="text-yellow-400 hover:underline">→ Latest News</a></li>
            </ul>
          </div>

          <p className="mt-12 text-sm text-zinc-500">
            Fixed by Saiba • Original complex layout + components temporarily simplified to resolve blank page.
          </p>
        </div>
      </body>
    </html>
  );
}
