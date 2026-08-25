"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourierShell } from "@/components/courier-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";

type Earnings = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
};

export default function CourierEarningsPage() {
  const router = useRouter();
  const [data, setData] = useState<Earnings | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "courier") {
        router.push("/courier/login");
        return;
      }
      const res = await api<Earnings>("/api/courier?type=earnings");
      setData(res.data || null);
    })();
  }, [router]);

  if (!data) {
    return (
      <CourierShell>
        <LoadingBlock />
      </CourierShell>
    );
  }

  const items = [
    { label: "Today", value: data.today },
    { label: "This Week", value: data.thisWeek },
    { label: "This Month", value: data.thisMonth },
    { label: "All Time", value: data.total },
  ];

  return (
    <CourierShell>
      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl font-semibold">Earnings</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Pendapatan dari ongkir order selesai
        </p>
        <div className="mt-4 space-y-3">
          {items.map((i) => (
            <div key={i.label} className="card flex items-center justify-between p-4">
              <span className="text-[var(--fg-muted)]">{i.label}</span>
              <span className="text-lg font-bold text-[var(--brand)]">
                <Money amount={i.value} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </CourierShell>
  );
}
