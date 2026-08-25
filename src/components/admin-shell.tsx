"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Shirt,
  Tags,
  Users,
  Bike,
  MapPin,
  Percent,
  CreditCard,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  Kanban,
  Wallet,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/context";
import {
  DELIVERY_QUEUE_STATUSES,
  PICKUP_QUEUE_STATUSES,
} from "@/lib/order-status";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [billingLocked, setBillingLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [logisticsCount, setLogisticsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const [billing, orders, chat] = await Promise.all([
        api<{
          locked: boolean;
          lockReason: string | null;
        }>("/api/admin?resource=billing"),
        api<{ orderStatus: string }[]>("/api/orders"),
        api<{ unread: number }>("/api/messages?unreadCount=true"),
      ]);

      if (billing.success && billing.data?.locked) {
        setBillingLocked(true);
        setLockReason(billing.data.lockReason);
      } else {
        setBillingLocked(false);
        setLockReason(null);
      }

      if (orders.success && orders.data) {
        const pickup = PICKUP_QUEUE_STATUSES as readonly string[];
        const delivery = DELIVERY_QUEUE_STATUSES as readonly string[];
        const list = orders.data;
        const logN = list.filter(
          (o) =>
            pickup.includes(o.orderStatus) || delivery.includes(o.orderStatus)
        ).length;
        const excluded = new Set(["completed", "cancelled", "delivered"]);
        const activeN = list.filter((o) => !excluded.has(o.orderStatus)).length;
        setLogisticsCount(logN);
        setOrdersCount(activeN);
      } else {
        setLogisticsCount(0);
        setOrdersCount(0);
      }

      if (chat.success && chat.data) {
        setChatUnread(chat.data.unread || 0);
      } else {
        setChatUnread(0);
      }
    })();
  }, [pathname]);

  const links = [
    { href: "/admin", label: t("admin.nav.dashboard"), icon: LayoutDashboard },
    {
      href: "/admin/orders",
      label: t("admin.nav.orders"),
      icon: Package,
      badge: ordersCount > 0 ? ordersCount : undefined,
    },
    {
      href: "/admin/messages",
      label: "Pesan",
      icon: MessageSquare,
      badge: chatUnread > 0 ? chatUnread : undefined,
    },
    {
      href: "/admin/logistics",
      label: t("admin.nav.logistics"),
      icon: Bike,
      badge: logisticsCount > 0 ? logisticsCount : undefined,
    },
    { href: "/admin/laundry", label: t("admin.nav.laundry"), icon: Kanban },
    { href: "/admin/services", label: t("admin.nav.services"), icon: Shirt },
    { href: "/admin/pricing", label: t("admin.nav.pricing"), icon: Tags },
    { href: "/admin/customers", label: t("admin.nav.customers"), icon: Users },
    { href: "/admin/outlets", label: t("admin.nav.outlets"), icon: MapPin },
    { href: "/admin/promos", label: t("admin.nav.promos"), icon: Percent },
    { href: "/admin/payments", label: t("admin.nav.payments"), icon: CreditCard },
    {
      href: "/admin/payment-accounts",
      label: "Rekening bayar",
      icon: Landmark,
    },
    { href: "/admin/billing", label: t("admin.nav.billing"), icon: Wallet },
    { href: "/admin/reports", label: t("admin.nav.reports"), icon: BarChart3 },
    { href: "/admin/settings", label: t("admin.nav.settings"), icon: Settings },
  ];

  async function logout() {
    await api("/api/auth?action=logout", { method: "POST", body: "{}" });
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-[#eef3f4]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[#0f1f24] text-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-xl font-semibold tracking-tight">
            Laundry<span className="text-[#5eead4]">Admin</span>
          </p>
          <p className="mt-1 text-xs text-white/50">{t("admin.brand")}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));
            const Icon = link.icon;
            const badge =
              "badge" in link &&
              typeof link.badge === "number" &&
              link.badge > 0
                ? link.badge
                : null;

            return (
              <div key={link.href} className="relative">
                {badge != null && (
                  <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0f1f24] bg-[#f43f5e] px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} />
          {t("common.logout")}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden">
            <p className="font-display font-semibold">Laundry Admin</p>
          </div>
          <p className="hidden text-sm text-[var(--fg-muted)] md:block">
            {t("admin.subtitle")}
          </p>
          <button
            type="button"
            onClick={logout}
            className="btn-ghost text-sm md:hidden"
          >
            {t("common.logout")}
          </button>
        </header>
        {billingLocked && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 md:px-8">
            <span className="font-semibold">Sistem terkunci. </span>
            {lockReason || "Tagihan fee platform belum dibayar."}{" "}
            <Link
              href="/admin/billing"
              className="font-semibold underline underline-offset-2"
            >
              Buka Tagihan SaaS
            </Link>
          </div>
        )}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
