"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Package, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client-api";

const tabs = [
  { href: "/courier", label: "Home", icon: Home },
  { href: "/courier/orders", label: "Orders", icon: Package },
  { href: "/courier/earnings", label: "Earnings", icon: Wallet },
  { href: "/courier/profile", label: "Profil", icon: User },
];

export function CourierShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth?action=logout", { method: "POST", body: "{}" });
    router.push("/courier/login");
  }

  return (
    <div className="page-bg min-h-screen">
      <div className="mx-auto min-h-screen max-w-lg pb-24">
        <header className="flex items-center justify-between px-4 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
              Courier
            </p>
            <p className="font-display text-lg font-semibold">On-Demand</p>
          </div>
          <button onClick={logout} className="text-xs font-medium text-[var(--fg-muted)]">
            Logout
          </button>
        </header>
        {children}
      </div>
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/courier" && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-w-[64px] flex-col items-center gap-0.5 py-1 text-[10px] font-medium",
                  active ? "text-[var(--brand)]" : "text-[var(--fg-muted)]"
                )}
              >
                <Icon size={20} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
