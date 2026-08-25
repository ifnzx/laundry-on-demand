"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import { NotificationProvider } from "@/components/notification-context";
import { api } from "@/lib/client-api";

export function CustomerNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadUnread() {
      const res = await api<{ unread: number }>(
        "/api/messages?unreadCount=true"
      );
      if (!cancelled && res.success && res.data) {
        setChatUnread(res.data.unread || 0);
      }
    }
    void loadUnread();
    const id = setInterval(() => void loadUnread(), 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  const tabs = [
    { href: "/home", label: t("nav.home"), icon: "home" },
    { href: "/orders", label: t("nav.orders"), icon: "receipt_long" },
    { href: "/promos", label: t("nav.promo"), icon: "local_offer" },
    { href: "/messages", label: t("nav.chat"), icon: "chat", badge: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full rounded-t-xl bg-surface-container-lowest px-4 py-2 shadow-[0_-4px_24px_rgba(25,27,35,0.08)] safe-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/home" && pathname.startsWith(tab.href)) ||
            (tab.href === "/messages" && pathname.includes("/chat"));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex min-w-[4.5rem] flex-col items-center justify-center px-3 py-1",
                "transition-colors duration-150",
                active ? "text-primary" : "text-on-surface-variant"
              )}
            >
              <span className="relative">
                <span
                  className={cn(
                    "material-symbols-outlined text-[22px] leading-none",
                    active && "fill"
                  )}
                  aria-hidden
                >
                  {tab.icon}
                </span>
                {tab.badge && chatUnread > 0 && (
                  <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold leading-none text-on-error">
                    {chatUnread > 9 ? "9+" : chatUnread}
                  </span>
                )}
              </span>
              <span className="mt-0.5 text-[12px] font-medium leading-4">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function CustomerShell({
  children,
  hideNav,
  className,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
  className?: string;
}) {
  return (
    <NotificationProvider>
      <div className={cn("min-h-screen bg-background text-on-surface", className)}>
        <div className={cn("mx-auto min-h-screen max-w-lg", !hideNav && "pb-[80px]")}>
          {children}
        </div>
        {!hideNav && <CustomerNav />}
      </div>
    </NotificationProvider>
  );
}
