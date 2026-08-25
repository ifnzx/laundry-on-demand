"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CourierShell } from "@/components/courier-shell";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  distanceKm: number;
  service: { name: string };
  address: { address: string };
  customer: { name: string; phone: string };
};

export default function CourierOrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "pickup" | "delivery">("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "courier") {
        router.push("/courier/login");
        return;
      }
      setLoading(true);
      const res = await api<Order[]>(`/api/courier?type=${tab}`);
      setOrders(res.data || []);
      setLoading(false);
    })();
  }, [tab, router]);

  return (
    <CourierShell>
      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <div className="mt-3 flex gap-2 rounded-xl border border-[var(--border)] bg-white p-1">
          {(
            [
              ["active", "Aktif"],
              ["pickup", "Pickup"],
              ["delivery", "Delivery"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                tab === k ? "bg-[var(--brand)] text-white" : "text-[var(--fg-muted)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={
                  o.orderStatus.includes("delivery") ||
                  o.orderStatus === "ready_for_delivery"
                    ? `/courier/delivery/${o.id}`
                    : `/courier/pickup/${o.id}`
                }
                className="card block p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-[var(--fg-muted)]">{o.orderNumber}</p>
                    <p className="font-semibold">{o.customer.name}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{o.address.address}</p>
                  </div>
                  <StatusBadge status={o.orderStatus} />
                </div>
              </Link>
            ))}
            {orders.length === 0 && (
              <p className="py-10 text-center text-sm text-[var(--fg-muted)]">
                Tidak ada order
              </p>
            )}
          </div>
        )}
      </div>
    </CourierShell>
  );
}
