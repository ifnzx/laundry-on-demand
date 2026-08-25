"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/order-status";

type Order = {
  orderNumber: string;
  orderStatus: string;
  courier?: { name: string; phone: string; vehicle?: string | null } | null;
  outlet?: { name: string; phone: string } | null;
  statusHistory: { status: string; note?: string | null; createdAt: string }[];
  address: { address: string };
  service: { name: string };
};

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    async function load() {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const res = await api<Order>(`/api/orders?id=${id}`);
      if (res.success) setOrder(res.data || null);
    }
    load();
    timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [id, router]);

  if (!order) {
    return (
      <CustomerShell>
        <LoadingBlock label="Melacak order..." />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="px-4 pt-6">
        <Link href={`/orders/${id}`} className="text-sm text-[var(--brand)]">
          ← Detail
        </Link>
        <h1 className="font-display mt-2 text-2xl font-semibold">Lacak Order</h1>
        <p className="text-sm text-[var(--fg-muted)]">{order.orderNumber}</p>

        <div className="card mt-4 p-5 text-center">
          <StatusBadge status={order.orderStatus} />
          <p className="font-display mt-3 text-xl font-semibold">
            {STATUS_LABELS[order.orderStatus] || order.orderStatus}
          </p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {order.service.name} · {order.address.address}
          </p>
        </div>

        <div className="card mt-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Bantuan
          </p>
          {(order.courier || order.outlet) && (
            <p className="mt-1 text-sm font-medium">
              {order.courier?.name || order.outlet?.name || "Outlet"}
            </p>
          )}
          <Link
            href={`/orders/${id}/chat`}
            className="btn btn-primary mt-3 w-full"
          >
            Chat outlet
          </Link>
        </div>

        <div className="card mt-4 p-4">
          <h2 className="font-semibold mb-4">Status Journey</h2>
          <div className="relative space-y-0">
            {order.statusHistory.map((h, i) => (
              <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                {i < order.statusHistory.length - 1 && (
                  <div className="absolute left-[7px] top-3 h-full w-0.5 bg-[var(--brand)]/30" />
                )}
                <div className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--brand)] ring-4 ring-[var(--brand-soft)]" />
                <div>
                  <p className="font-medium text-sm">
                    {STATUS_LABELS[h.status] || h.status}
                  </p>
                  {h.note && (
                    <p className="text-xs text-[var(--fg-muted)]">{h.note}</p>
                  )}
                  <p className="text-xs text-[var(--fg-muted)]">
                    {formatDateTime(h.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
