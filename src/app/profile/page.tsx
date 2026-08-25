"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";
import {
  MapPin,
  Package,
  Tag,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Settings,
  Bell,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

type User = {
  name: string;
  phone: string;
  email?: string | null;
  photo?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api<User>("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      setUser(me.data || null);
    })();
  }, [router]);

  async function logout() {
    await api("/api/auth?action=logout", { method: "POST", body: "{}" });
    router.push("/login");
  }

  if (!user) {
    return (
      <CustomerShell>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  const menu = [
    { href: "/notifications", label: t("nav.notifications"), icon: Bell },
    { href: "/profile/addresses", label: t("profile.addresses"), icon: MapPin },
    { href: "/orders", label: t("profile.orderHistory"), icon: Package },
    { href: "/promos", label: t("profile.promos"), icon: Tag },
    { href: "/profile/settings", label: t("profile.settings"), icon: Settings },
    { href: "#", label: t("profile.help"), icon: HelpCircle },
    { href: "#", label: t("profile.about"), icon: Info },
  ];

  return (
    <CustomerShell>
      <div className="px-4 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("profile.title")}</h2>
          <LanguageSwitcher variant="compact" />
        </div>

        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-on-primary">
            {user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-sm text-on-surface-variant">{user.phone}</p>
            {user.email && (
              <p className="text-sm text-on-surface-variant">{user.email}</p>
            )}
          </div>
        </div>

        <div className="card mt-4 divide-y divide-outline-variant">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <Icon size={18} className="text-primary" />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronRight size={16} className="text-on-surface-variant" />
              </Link>
            );
          })}
        </div>

        <button
          onClick={logout}
          className="card mt-4 flex w-full items-center gap-3 px-4 py-3.5 text-red-600"
        >
          <LogOut size={18} />
          <span className="font-medium">{t("common.logout")}</span>
        </button>
      </div>
    </CustomerShell>
  );
}
