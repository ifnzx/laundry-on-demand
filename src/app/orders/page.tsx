"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import {
  EmptyState,
  LoadingBlock,
  Money,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/context";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  total: number;
  estimatedWeight: number;
  actualWeight?: number | null;
  service: { name: string };
  createdAt: string;
};

type TabKey = "active" | "completed" | "cancelled";

export default function OrdersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      setLoading(true);
      setError("");
      const res = await api<Order[]>(`/api/orders?filter=${tab}`);
      if (cancelled) return;
      if (!res.success) {
        setError(res.error || "Gagal memuat pesanan");
        setOrders([]);
      } else {
        setOrders(res.data || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, router]);

  return (
    <CustomerShell>
      <div className="px-4 pt-6 pb-4">
        <PageHeader
          title={t("orders.title")}
          subtitle={t("orders.subtitle")}
        />
        <div
          className="mb-4 flex gap-1 rounded-xl border border-outline-variant bg-white p-1"
          role="tablist"
          aria-label="Filter pesanan"
        >
          {(
            [
              ["active", t("orders.active")],
              ["completed", t("orders.completed")],
              ["cancelled", t("orders.cancelled")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? "flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary shadow-sm"
                  : "flex-1 rounded-lg py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <LoadingBlock />
        ) : orders.length === 0 ? (
          <EmptyState
            title={t("orders.empty")}
            description={t("orders.emptyHint")}
            action={
              tab === "active" ? (
                <Link href="/booking" className="btn btn-primary">
                  {t("orders.orderLaundry")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="card block p-4 transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-on-surface-variant">
                      {o.orderNumber}
                    </p>
                    <p className="font-semibold text-on-surface">
                      {o.service.name}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {o.actualWeight != null
                        ? `${o.actualWeight} kg`
                        : "Belum timbang"}{" "}
                      · <Money amount={o.total} />
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {formatDateTime(o.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={o.orderStatus} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
