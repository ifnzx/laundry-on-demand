"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { EmptyState, LoadingBlock, Money, PageHeader } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

type Promo = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minimumOrder: number;
  maximumDiscount?: number | null;
  endDate: string;
};

export default function PromosPage() {
  const router = useRouter();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const res = await api<Promo[]>("/api/profile");
      setPromos(res.data || []);
      setLoading(false);
    })();
  }, [router]);

  return (
    <CustomerShell>
      <div className="px-4 pt-6">
        <PageHeader title="Promo" subtitle="Kode diskon aktif" />
        {loading ? (
          <LoadingBlock />
        ) : promos.length === 0 ? (
          <EmptyState title="Tidak ada promo" description="Cek lagi nanti." />
        ) : (
          <div className="space-y-3">
            {promos.map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d8a7c] to-[#127a9a] p-5 text-white"
              >
                <p className="text-xs font-bold tracking-widest opacity-80">
                  {p.code}
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm">
                  {p.type === "percentage" ? `${p.value}%` : <Money amount={p.value} />}{" "}
                  · min. order <Money amount={p.minimumOrder} />
                </p>
                <p className="mt-3 text-xs opacity-75">
                  Berlaku hingga {formatDate(p.endDate)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
