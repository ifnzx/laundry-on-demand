"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";
import { setBookingDraft, serviceVisual } from "@/lib/booking-draft";
import { cn } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  pricingType?: string;
  estimatedDuration: number;
};

function unitLabel(type?: string) {
  if (type === "per_item") return "/ item";
  if (type === "fixed") return " (paket)";
  return "/ kg";
}

export default function ServicesPage() {
  const router = useRouter();
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
      setServices(res.data || []);
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

  return (
    <CustomerShell>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant/60 bg-surface px-4">
        <Link
          href="/home"
          className="-ml-1 rounded-full p-2 text-primary transition-colors hover:bg-surface-variant/50"
          aria-label="Kembali"
        >
          <span className="material-symbols-outlined text-[22px]">
            arrow_back
          </span>
        </Link>
        <h1 className="text-lg font-bold text-on-surface">Layanan</h1>
      </header>

      <div className="px-4 py-5">
        {loading ? (
          <LoadingBlock />
        ) : services.length === 0 ? (
          <p className="py-12 text-center text-sm text-on-surface-variant">
            Belum ada layanan tersedia.
          </p>
        ) : (
          <ul className="space-y-3">
            {services.map((s) => {
              const v = serviceVisual(s.name);
              const blurb = s.description?.trim() || v.blurb;
              return (
                <li key={s.id}>
                  <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-sm">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        v.express
                          ? "bg-error/10 text-error"
                          : "bg-primary-container/15 text-primary"
                      )}
                    >
                      <span className="material-symbols-outlined fill text-[26px]">
                        {v.icon}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-on-surface">
                          {s.name}
                        </h3>
                        {v.express && (
                          <span className="shrink-0 rounded-md bg-error/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
                            Express
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-on-surface-variant">
                        {blurb}
                      </p>
                      <p className="mt-1.5 text-sm font-bold tabular-nums text-primary">
                        <Money amount={s.price} />
                        <span className="text-xs font-medium text-on-surface-variant">
                          {unitLabel(s.pricingType)}
                        </span>
                        <span className="ml-2 text-xs font-normal text-on-surface-variant">
                          · ~{s.estimatedDuration} jam
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => pick(s)}
                      className="btn btn-primary shrink-0 !px-3.5 !py-2 text-sm"
                    >
                      Pilih
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CustomerShell>
  );
}
