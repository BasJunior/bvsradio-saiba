"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/account", label: "Overview", match: "account" },
  { href: "/library", label: "Library", match: "library" },
  { href: "/library?section=downloads", label: "Downloads", match: "downloads" },
  { href: "/account/orders", label: "Orders", match: "orders" },
  { href: "/notifications", label: "Notifications", match: "notifications" },
];

export default function AccountWorkspaceNav() {
  const pathname = usePathname();

  const activeFor = (match: string) => {
    if (match === "account") return pathname === "/account";
    if (match === "orders") return pathname.startsWith("/account/orders");
    return false;
  };

  return (
    <nav aria-label="Account workspace" className="flex gap-2 overflow-x-auto py-3">
      {links.map((item) => (
        <Link key={item.href} href={item.href} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${activeFor(item.match) ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
