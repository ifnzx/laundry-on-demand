"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";
import { LAUNDRY_KANBAN_COLUMNS } from "@/lib/order-status";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  estimatedWeight: number;
  actualWeight?: number | null;
  customer: { name: string };
  service: { name: string };
};

export default function LaundryBoardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api<Order[]>("/api/admin?resource=laundry");
    setOrders(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      await load();
    })();
  }, [router]);

  async function move(orderId: string, status: string) {
    await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({ action: "update_status", orderId, status }),
    });
    await load();
  }

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Papan Laundry</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Alur proses laundry di outlet (scroll ke bawah per tahap)
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {LAUNDRY_KANBAN_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.orderStatus === col.key);
          return (
            <section
              key={col.key}
              className="rounded-2xl border border-[var(--border)] bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {col.label}
                </h3>
                <span className="badge bg-[var(--brand-soft)] text-[var(--brand)]">
                  {colOrders.length}
                </span>
              </div>

              {colOrders.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--fg-muted)]">
                  Kosong
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {colOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-sm font-semibold text-[var(--brand)]"
                        >
                          {o.orderNumber}
                        </Link>
                        <p className="mt-0.5 text-sm font-medium">
                          {o.customer.name}
                        </p>
                        <p className="text-xs text-[var(--fg-muted)]">
                          {o.service.name} ·{" "}
                          {o.actualWeight != null
                            ? `${o.actualWeight} kg`
                            : "belum timbang"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {col.key === "received_at_outlet" && (
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                          >
                            Timbang
                          </Link>
                        )}
                        {col.key === "washing" && (
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                            onClick={() => move(o.id, "drying")}
                          >
                            → Drying
                          </button>
                        )}
                        {col.key === "drying" && (
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                            onClick={() => move(o.id, "ironing")}
                          >
                            → Ironing
                          </button>
                        )}
                        {col.key === "ironing" && (
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                            onClick={() => move(o.id, "packing")}
                          >
                            → Packing
                          </button>
                        )}
                        {col.key === "packing" && (
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                            onClick={() => move(o.id, "ready_for_delivery")}
                          >
                            → Ready
                          </button>
                        )}
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]"
                        >
                          Detail
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
