"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";
import { setBookingDraft } from "@/lib/booking-draft";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  estimatedDuration: number;
};

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const res = await api<Service[]>("/api/services");
      setService((res.data || []).find((s) => s.id === id) || null);
    })();
  }, [id, router]);

  if (!service) {
    return (
      <CustomerShell>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  function startBooking() {
    if (!service) return;
    setBookingDraft({
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
    });
    router.push("/booking/address");
  }

  return (
    <CustomerShell>
      <div className="px-4 pt-6">
        <Link href="/booking" className="text-sm font-medium text-primary">
          ← Kembali
        </Link>
        <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-on-surface">{service.name}</h1>
          <p className="mt-3 text-on-surface-variant">{service.description}</p>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-sm text-on-surface-variant">Harga</p>
              <p className="text-2xl font-bold text-primary">
                <Money amount={service.price} />
                <span className="text-base font-normal text-on-surface-variant">
                  {" "}
                  /kg
                </span>
              </p>
            </div>
            <p className="text-sm text-on-surface-variant">
              ~{service.estimatedDuration} jam
            </p>
          </div>
          <button type="button" onClick={startBooking} className="btn btn-primary mt-8 w-full">
            Pesan Layanan Ini
          </button>
        </div>
      </div>
    </CustomerShell>
  );
}
