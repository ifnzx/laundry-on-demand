"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  customer: { name: string; phone: string };
  service: { name: string };
  courier?: { name: string } | null;
  /** Unread chat messages from customer (admin list only) */
  unreadMessages?: number;
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Belum bayar",
  paid: "Lunas",
  partial: "Sebagian",
  refunded: "Refund",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const res = await api<Order[]>("/api/orders");
    setOrders(res.data || []);
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      await load();
    })();
  }, [router, load]);

  // Refresh message badges while admin stays on this page
  useEffect(() => {
    const t = setInterval(() => void load({ silent: true }), 8000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status && o.orderStatus !== status) return false;
      if (!term) return true;
      return (
        o.orderNumber.toLowerCase().includes(term) ||
        o.customer.name.toLowerCase().includes(term) ||
        o.customer.phone.toLowerCase().includes(term) ||
        o.service.name.toLowerCase().includes(term)
      );
    });
  }, [orders, q, status]);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Pesanan</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {filtered.length} dari {orders.length} order
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => void load()}
        >
          Muat ulang
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="order-q">
            Cari
          </label>
          <input
            id="order-q"
            className="input"
            placeholder="No. order, nama, telepon, layanan..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="label" htmlFor="order-status">
            Status
          </label>
          <select
            id="order-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] || s}
              </option>
            ))}
          </select>
        </div>
        {(q || status) && (
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            onClick={() => {
              setQ("");
              setStatus("");
            }}
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { value: "", label: "Semua" },
          { value: "pending_payment", label: "Menunggu bayar" },
          { value: "waiting_courier", label: "Jemput" },
          { value: "washing", label: "Cuci" },
          { value: "ready_for_delivery", label: "Siap antar" },
          { value: "completed", label: "Selesai" },
          { value: "cancelled", label: "Batal" },
        ].map((chip) => {
          const active = status === chip.value;
          return (
            <button
              key={chip.value || "all"}
              type="button"
              onClick={() => setStatus(chip.value)}
              className={
                active
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary"
                  : "rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-primary/40"
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-[var(--fg-muted)]">
          Tidak ada pesanan yang cocok dengan filter.
          {(q || status) && (
            <button
              type="button"
              className="btn btn-secondary mt-4"
              onClick={() => {
                setQ("");
                setStatus("");
              }}
            >
              Hapus filter
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((o) => {
            const unread = o.unreadMessages || 0;
            const hasUnread = unread > 0;
            return (
            <li key={o.id}>
              <article
                className={
                  hasUnread
                    ? "rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-4 shadow-sm ring-1 ring-primary/15 transition"
                    : "rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm transition hover:border-primary/30"
                }
              >
                {/* Row 1: identity + statuses */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-sm font-bold tracking-tight text-[var(--brand)] hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      {hasUnread && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-on-primary">
                          <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
                          {unread} pesan baru
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                      {formatDateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusBadge status={o.orderStatus} />
                    <span
                      className={
                        o.paymentStatus === "paid"
                          ? "badge bg-emerald-100 text-emerald-800"
                          : o.paymentStatus === "partial"
                            ? "badge bg-amber-100 text-amber-800"
                            : "badge bg-gray-100 text-gray-700"
                      }
                    >
                      {PAYMENT_LABEL[o.paymentStatus] || o.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Row 2: details grid — never cramped into 7 table cols */}
                <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                      Customer
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--fg)] break-words">
                      {o.customer.name}
                    </p>
                    <p className="text-sm text-[var(--fg-muted)]">
                      {o.customer.phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                      Layanan
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--fg)] break-words">
                      {o.service.name}
                    </p>
                    <p className="text-sm text-[var(--fg-muted)]">
                      Handler: {o.courier?.name || "—"}
                    </p>
                  </div>
                </div>

                {/* Row 3: total + action */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                      Total
                    </p>
                    <p className="text-lg font-bold tabular-nums text-[var(--fg)]">
                      <Money amount={o.total} />
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasUnread && (
                      <Link
                        href={`/admin/messages?orderId=${o.id}`}
                        className="btn btn-secondary !px-3 !py-2 text-sm inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Balas pesan
                      </Link>
                    )}
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="btn btn-primary !px-4 !py-2 text-sm"
                    >
                      Kelola order
                    </Link>
                  </div>
                </div>
              </article>
            </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
