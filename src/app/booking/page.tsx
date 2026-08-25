"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Droplets,
  Shirt,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";
import { setBookingDraft, isSpecialLaundryService } from "@/lib/booking-draft";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  pricingType?: string;
  estimatedDuration: number;
};

function serviceIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("express") || n.includes("kilat")) return Zap;
  if (n.includes("setrika") && !n.includes("cuci")) return Wind;
  if (n.includes("cuci") && n.includes("setrika")) return Shirt;
  if (n.includes("cuci")) return Droplets;
  return Shirt;
}

function serviceNote(s: Service): string {
  if (s.description?.trim()) return s.description.trim();
  if (s.estimatedDuration > 0) {
    const h = s.estimatedDuration;
    if (h < 24) return `Estimasi selesai ${h} jam`;
    const d = Math.round(h / 24);
    return d <= 1 ? "Estimasi selesai 1 hari" : `Estimasi selesai ${d} hari`;
  }
  return "Harga dihitung per kg setelah penimbangan";
}

export default function SelectServicePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const res = await api<Service[]>("/api/services");
      setServices(
        (res.data || []).filter((s) => !isSpecialLaundryService(s))
      );
      setLoading(false);
    })();
  }, [router]);

  function pick(s: Service) {
    setBookingDraft({
      serviceId: s.id,
      serviceName: s.name,
      servicePrice: s.price,
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
          {t("booking.selectService")}
        </h1>
      </header>

      <main className="px-4 py-5 pb-10">
        <p className="mb-4 text-sm text-on-surface-variant">
          {t("booking.regularSubtitle")}
        </p>

        {services.length === 0 ? (
          <p className="py-12 text-center text-sm text-on-surface-variant">
            {t("common.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/50 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest">
            {services.map((s) => {
              const Icon = serviceIcon(s.name);
              const express = /express|kilat/i.test(s.name);

              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-container/80 active:bg-surface-container"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        express
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container text-on-surface-variant"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-snug text-on-surface">
                            {s.name}
                            {express && (
                              <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                                {t("booking.fast")}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                            {serviceNote(s)}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-outline" />
                      </div>

                      <p className="mt-2.5 text-sm font-semibold text-on-surface">
                        <Money amount={s.price} />
                        <span className="ml-1 text-xs font-normal text-on-surface-variant">
                          / kg
                        </span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          <Link href="/booking/khusus" className="font-medium text-primary">
            {t("booking.specialTitle")}
          </Link>
          {" · "}
          <Link href="/services" className="font-medium text-primary">
            {t("booking.seeDetail")}
          </Link>
        </p>
      </main>
    </CustomerShell>
  );
}
