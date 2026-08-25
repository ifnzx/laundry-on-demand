"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Baby,
  BedDouble,
  Footprints,
  Minus,
  Plus,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";
import {
  isSpecialLaundryService,
  setBookingDraft,
} from "@/lib/booking-draft";
import { useI18n } from "@/i18n/context";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  pricingType?: string;
  estimatedDuration: number;
};

type SpecMeta = {
  key: string;
  title: string;
  unit: string;
  blurb: string;
  Icon: LucideIcon;
};

const SPECIAL_ORDER = ["sepatu", "tas", "selimut", "boneka"] as const;

const META: Record<(typeof SPECIAL_ORDER)[number], SpecMeta> = {
  sepatu: {
    key: "sepatu",
    title: "Sepatu",
    unit: "/pasang",
    blurb: "Deep clean & kering",
    Icon: Footprints,
  },
  tas: {
    key: "tas",
    title: "Tas",
    unit: "/item",
    blurb: "Cuci luar & dalam",
    Icon: ShoppingBag,
  },
  selimut: {
    key: "selimut",
    title: "Selimut",
    unit: "/lembar",
    blurb: "Cuci & kering sempurna",
    Icon: BedDouble,
  },
  boneka: {
    key: "boneka",
    title: "Boneka",
    unit: "/item",
    blurb: "Cuci lembut & higienis",
    Icon: Baby,
  },
};

function matchMeta(name: string): SpecMeta {
  const n = name.toLowerCase();
  for (const key of SPECIAL_ORDER) {
    if (n.includes(key)) return META[key];
  }
  return {
    key: "other",
    title: name.replace(/^laundry\s+/i, "").trim() || name,
    unit: "/item",
    blurb: "Perawatan khusus",
    Icon: ShoppingBag,
  };
}

function sortSpecial(list: Service[]) {
  return [...list].sort((a, b) => {
    const ia = SPECIAL_ORDER.findIndex((k) =>
      a.name.toLowerCase().includes(k)
    );
    const ib = SPECIAL_ORDER.findIndex((k) =>
      b.name.toLowerCase().includes(k)
    );
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export default function SpecialLaundryBookingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const res = await api<Service[]>("/api/services");
      const specials = sortSpecial(
        (res.data || []).filter((s) => isSpecialLaundryService(s))
      );
      setServices(specials);
      const init: Record<string, number> = {};
      for (const s of specials) init[s.id] = 1;
      setQty(init);
      setLoading(false);
    })();
  }, [router]);

  const empty = useMemo(
    () => !loading && services.length === 0,
    [loading, services]
  );

  function changeQty(id: string, delta: number) {
    setQty((prev) => {
      const next = Math.max(1, Math.min(20, (prev[id] || 1) + delta));
      return { ...prev, [id]: next };
    });
  }

  function pick(s: Service) {
    const n = qty[s.id] || 1;
    const meta = matchMeta(s.name);
    setBookingDraft({
      serviceId: s.id,
      serviceName: `Laundry ${meta.title}`,
      servicePrice: s.price,
      pricingType: s.pricingType || "per_item",
      itemQty: n,
    });
    router.push("/booking/address");
  }

  if (loading) {
    return (
      <CustomerShell>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant/40 bg-surface px-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="-ml-1 rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-on-surface">
          {t("booking.specialTitle")}
        </h1>
      </header>

      <main className="px-4 py-5 pb-10">
        <p className="mb-4 text-sm text-on-surface-variant">
          Pilih item. Harga per satuan + ongkir di checkout.
        </p>

        {empty ? (
          <p className="py-12 text-center text-sm text-on-surface-variant">
            Layanan khusus belum tersedia.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {services.map((s) => {
              const meta = matchMeta(s.name);
              const Icon = meta.Icon;
              const n = qty[s.id] || 1;
              const lineTotal = s.price * n;

              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-3.5"
                >
                  <div className="flex gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-on-surface">
                          {meta.title}
                        </h3>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-on-surface">
                          <Money amount={s.price} />
                          <span className="ml-0.5 text-[11px] font-normal text-on-surface-variant">
                            {meta.unit}
                          </span>
                        </p>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug text-on-surface-variant">
                        {meta.blurb}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-outline-variant/40 pt-3">
                    <div className="flex shrink-0 items-center rounded-lg border border-outline-variant bg-white">
                      <button
                        type="button"
                        onClick={() => changeQty(s.id, -1)}
                        disabled={n <= 1}
                        className="flex h-8 w-8 items-center justify-center text-on-surface disabled:opacity-35"
                        aria-label="Kurangi"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                        {n}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(s.id, 1)}
                        disabled={n >= 20}
                        className="flex h-8 w-8 items-center justify-center text-on-surface disabled:opacity-35"
                        aria-label="Tambah"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => pick(s)}
                      className="ml-auto inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-on-primary transition hover:bg-primary/90 active:scale-[0.98]"
                    >
                      <span>Pilih</span>
                      <span
                        className="h-3.5 w-px shrink-0 bg-on-primary/35"
                        aria-hidden
                      />
                      <span className="tabular-nums tracking-tight">
                        <Money amount={lineTotal} />
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </CustomerShell>
  );
}
