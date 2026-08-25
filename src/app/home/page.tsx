"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { NotificationBell } from "@/components/notification-bell";
import { useNotifications } from "@/components/notification-context";
import { LoadingBlock, Money, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatRupiah } from "@/lib/utils";
import { setBookingDraft, isSpecialLaundryService } from "@/lib/booking-draft";
import { useI18n } from "@/i18n/context";

type User = { name: string; phone: string; photo?: string | null };
type Service = {
  id: string;
  name: string;
  price: number;
  pricingType?: string;
  description?: string | null;
};
type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  total: number;
  estimatedWeight: number;
  service: { name: string };
  createdAt: string;
};
type Address = {
  label: string;
  address: string;
  isDefault: boolean;
  notes?: string | null;
};
type Promo = {
  code: string;
  name: string;
  value: number;
  type: string;
};

const SERVICE_META: Record<
  string,
  { icon: string; color: string; bg: string; fast?: boolean }
> = {
  "cuci + setrika": {
    icon: "dry_cleaning",
    color: "text-primary",
    bg: "bg-primary-container/20",
  },
  "cuci saja": {
    icon: "local_laundry_service",
    color: "text-secondary",
    bg: "bg-secondary-container/20",
  },
  setrika: {
    icon: "iron",
    color: "text-tertiary",
    bg: "bg-tertiary-container/20",
  },
  "setrika saja": {
    icon: "iron",
    color: "text-tertiary",
    bg: "bg-tertiary-container/20",
  },
  express: {
    icon: "bolt",
    color: "text-error",
    bg: "bg-error/10",
    fast: true,
  },
};

function serviceMeta(name: string) {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(SERVICE_META)) {
    if (key.includes(k)) return v;
  }
  return {
    icon: "checkroom",
    color: "text-on-surface-variant",
    bg: "bg-surface-variant",
  };
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [address, setAddress] = useState<Address | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);

  useEffect(() => {
    async function load() {
      const me = await api<User>("/api/auth");
      if (!me.success || !me.data) {
        router.push("/login");
        return;
      }
      setUser(me.data);

      const [svc, ord, addr, promoRes] = await Promise.all([
        api<Service[]>("/api/services"),
        api<Order[]>("/api/orders?filter=active"),
        api<Address[]>("/api/addresses"),
        api<Promo[]>("/api/profile"),
      ]);
      setServices(svc.data || []);
      setOrders(ord.data || []);
      const addrs = addr.data || [];
      setAddress(addrs.find((a) => a.isDefault) || addrs[0] || null);
      const promoList = Array.isArray(promoRes.data) ? promoRes.data : [];
      setPromos(promoList);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <CustomerShell>
      {loading || !user ? (
        <LoadingBlock />
      ) : (
        <HomeReady
          user={user}
          services={services}
          orders={orders}
          address={address}
          promos={promos}
        />
      )}
    </CustomerShell>
  );
}

function HomeReady({
  user,
  services,
  orders,
  address,
  promos,
}: {
  user: User;
  services: Service[];
  orders: Order[];
  address: Address | null;
  promos: Promo[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { latest: latestNotifs } = useNotifications();

  const activeOrder = orders[0];
  const promo = promos.length > 0 ? promos[0] : null;
  const gridServices = services.filter((s) => !isSpecialLaundryService(s));

  return (
    <>
      {/* Header */}
      <header className="px-4 pb-2 pt-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/profile"
            className="flex min-w-0 flex-1 items-center gap-3 outline-none transition active:opacity-90"
            aria-label={t("nav.profile")}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-sm font-semibold text-primary ring-2 ring-white shadow-sm">
              {user?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photo}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (user?.name || "?").charAt(0).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-tight text-on-surface">
                {t("home.greeting")}
                {user?.name ? `, ${user.name}` : ""}
              </span>
            </span>
          </Link>
          <NotificationBell />
        </div>

        <Link
          href="/profile/addresses"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-3 shadow-sm outline-none transition hover:border-primary/40 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-on-surface-variant">
              {t("home.pickupLabel")}
            </span>
            {address ? (
              <>
                <span className="mt-0.5 block truncate text-sm font-semibold text-on-surface">
                  {address.label}
                </span>
                <span className="mt-0.5 block line-clamp-1 text-xs text-on-surface-variant">
                  {address.address}
                  {address.notes ? ` · ${address.notes}` : ""}
                </span>
              </>
            ) : (
              <span className="mt-0.5 block text-sm font-medium text-primary">
                {t("home.addAddress")}
              </span>
            )}
          </span>
          <span className="material-symbols-outlined shrink-0 text-[20px] text-on-surface-variant">
            chevron_right
          </span>
        </Link>
      </header>

      <main className="flex flex-col gap-6 px-4 pt-6">
        {/* Notifications — only while an active laundry order exists */}
        {activeOrder && latestNotifs.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-on-surface">
                {t("notif.latest")}
              </h2>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-primary"
              >
                {t("notif.seeAll")}
              </Link>
            </div>
            <ul className="space-y-2">
              {latestNotifs.slice(0, 2).map((n) => (
                <li key={n.id}>
                  <Link
                    href={
                      n.orderId
                        ? `/orders/${n.orderId}`
                        : "/notifications"
                    }
                    className={`block rounded-xl border px-3 py-2.5 transition active:scale-[0.99] ${
                      n.isRead
                        ? "border-outline-variant/40 bg-surface-container-lowest"
                        : "border-primary/25 bg-primary/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-snug ${
                          n.isRead
                            ? "font-medium text-on-surface"
                            : "font-semibold text-on-surface"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                      {n.message}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Active Order — only when laundry is in progress */}
        {activeOrder ? (
          <section className="border-b border-outline-variant/60 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
                  {t("home.activeOrder")}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold tracking-tight text-on-surface">
                  {activeOrder.orderNumber}
                </p>
                <p className="mt-0.5 truncate text-sm text-on-surface-variant">
                  {activeOrder.service.name}
                </p>
              </div>
              <StatusBadge status={activeOrder.orderStatus} />
            </div>
            <Link
              href={`/orders/${activeOrder.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              {t("home.viewOrder")}
              <span className="material-symbols-outlined text-[16px]">
                chevron_right
              </span>
            </Link>
          </section>
        ) : null}

        {/* Promo Banner — hanya jika ada promo aktif */}
        {promos.length > 0 && promo ? (
          <Link
            href="/promos"
            className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-secondary to-primary p-4 text-on-primary shadow-sm"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
              }}
            />
            <div className="relative z-10 w-2/3">
              <h3 className="mb-1 text-[20px] font-bold leading-7">
                {promo.type === "percentage"
                  ? t("home.discount", { value: promo.value })
                  : t("home.save", { value: formatRupiah(promo.value) })}
              </h3>
              <p className="text-sm leading-5 text-primary-fixed-dim">
                {promo.name}
              </p>
            </div>
            <div className="relative z-10 flex w-1/3 justify-end">
              <span className="material-symbols-outlined fill text-4xl opacity-80">
                local_offer
              </span>
            </div>
          </Link>
        ) : null}

        {/* Services */}
        <section>
          <h2 className="mb-4 text-[20px] font-semibold leading-7 text-on-surface">
            {t("home.servicesTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {gridServices.map((s) => {
              const meta = serviceMeta(s.name);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setBookingDraft({
                      serviceId: s.id,
                      serviceName: s.name,
                      servicePrice: s.price,
                    });
                    router.push("/booking/address");
                  }}
                  className="relative flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-center shadow-sm transition-transform duration-150 active:scale-95 hover:border-primary"
                >
                  {meta.fast && (
                    <div className="absolute right-0 top-0 rounded-bl-lg bg-error px-2 py-0.5 text-[10px] font-semibold text-on-error">
                      {t("booking.fast").toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}
                  >
                    <span className="material-symbols-outlined fill text-2xl">
                      {meta.icon}
                    </span>
                  </div>
                  <div className="w-full min-w-0">
                    <h4 className="line-clamp-2 text-sm font-medium leading-snug text-on-surface">
                      {s.name}
                    </h4>
                    <p className="mt-1 text-[12px] font-semibold tabular-nums tracking-wide text-on-surface-variant">
                      <Money amount={s.price} />
                      <span className="font-medium">
                        {s.pricingType === "per_item"
                          ? " / item"
                          : s.pricingType === "fixed"
                            ? " paket"
                            : " / kg"}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}

            <Link
              href="/booking/khusus"
              className="col-span-2 flex cursor-pointer flex-row items-center justify-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-sm transition-transform duration-150 active:scale-95 hover:border-primary"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant">
                <span className="material-symbols-outlined fill text-2xl">
                  checkroom
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-on-surface">
                  {t("home.specialLaundry")}
                </h4>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  {t("home.specialDesc")}
                </p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
