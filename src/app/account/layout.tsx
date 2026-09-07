import type { ReactNode } from "react";
import AccountWorkspaceNav from "@/components/account/AccountWorkspaceNav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="sticky top-16 z-40 border-b border-white/10 bg-bg-primary/90 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-primary/80">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <AccountWorkspaceNav />
        </div>
      </div>
      {children}
    </>
  );
}
