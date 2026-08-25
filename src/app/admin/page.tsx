"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";

type WeeklyBar = {
  weekStart: string;
  label: string;
  total: number;
  completed: number;
};

type Dashboard = {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  revenue: number;
  customers: number;
  couriers: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    total: number;
    createdAt: string;
    customer: { name: string };
    service: { name: string };
  }[];
  popularServices: { name: string; count: number }[];
  weeklyOrders: WeeklyBar[];
};

function WeeklyOrdersChart({ data }: { data: WeeklyBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const sum = data.reduce((s, d) => s + d.total, 0);
  const sumDone = data.reduce((s, d) => s + d.completed, 0);
  const peak = data.reduce(
    (best, d) => (d.total > best.total ? d : best),
    data[0] || { total: 0, label: "—", completed: 0, weekStart: "" }
  );
  const avg = data.length ? Math.round((sum / data.length) * 10) / 10 : 0;

  function shortLabel(label: string) {
    // "3 Agu–9 Agu" → "3 Agu"
    return label.split("–")[0]?.trim() || label;
  }

  return (
    <div>
      <div>
        <h2 className="font-semibold">Order per minggu</h2>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Tren 8 minggu terakhir
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total", value: String(sum), hint: "order" },
          { label: "Selesai", value: String(sumDone), hint: "order" },
          { label: "Rata-rata", value: String(avg), hint: "/ minggu" },
          {
            label: "Puncak",
            value: String(peak.total),
            hint: shortLabel(peak.label),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-2.5 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {s.label}
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight">
              {s.value}
            </p>
            <p className="truncate text-[10px] text-[var(--fg-muted)]">
              {s.hint}
            </p>
          </div>
        ))}
      </div>

      {/* CSS column chart — full width, readable */}
      <div className="mt-5">
        <div className="flex h-40 items-end gap-1.5 sm:gap-2">
          {data.map((d) => {
            const hPct = d.total > 0 ? Math.max((d.total / max) * 100, 8) : 0;
            const donePct =
              d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
            const isPeak = d.weekStart === peak.weekStart && peak.total > 0;
            return (
              <div
                key={d.weekStart}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`${d.label}: ${d.total} dibuat, ${d.completed} selesai`}
              >
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    d.total > 0
                      ? "text-[var(--fg)]"
                      : "text-[var(--fg-muted)]"
                  }`}
                >
                  {d.total}
                </span>
                <div className="relative flex h-28 w-full max-w-[2.5rem] items-end justify-center">
                  <div
                    className={`relative w-full overflow-hidden rounded-t-md bg-primary/25 transition group-hover:bg-primary/35 ${
                      isPeak ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    style={{
                      height: `${hPct}%`,
                      minHeight: d.total > 0 ? 6 : 2,
                    }}
                  >
                    {d.completed > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary"
                        style={{ height: `${donePct}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5 border-t border-[var(--border)] pt-2 sm:gap-2">
          {data.map((d) => (
            <div
              key={`lbl-${d.weekStart}`}
              className="min-w-0 flex-1 text-center"
            >
              <p className="truncate text-[10px] font-medium leading-tight text-[var(--fg-muted)]">
                {shortLabel(d.label)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/35" />
          Dibuat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
          Selesai
        </span>
        {peak.total > 0 && (
          <span className="font-medium text-[var(--fg)]">
            Puncak: {peak.label}
          </span>
        )}
      </div>
    </div>
  );
}

function PopularServicesPanel({
  items,
}: {
  items: { name: string; count: number }[];
}) {
  const ranked = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, 6),
    [items]
  );
  const total = ranked.reduce((s, i) => s + i.count, 0) || 1;
  const max = Math.max(1, ...ranked.map((i) => i.count));

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Layanan populer</h2>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            Berdasarkan jumlah order
          </p>
        </div>
        {ranked.length > 0 && (
          <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--brand)]">
            {total} order
          </span>
        )}
      </div>

      {ranked.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          Belum ada data layanan
        </p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {ranked.map((s, i) => {
            const pct = Math.round((s.count / total) * 100);
            const width = Math.round((s.count / max) * 100);
            return (
              <li key={s.name}>
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      i === 0
                        ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-on-primary"
                        : "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-high)] text-xs font-bold tabular-nums text-[var(--fg-muted)]"
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--fg)]">
                        {s.name}
                      </p>
                      <p className="shrink-0 text-sm tabular-nums">
                        <span className="font-bold">{s.count}</span>
                        <span className="ml-1 text-xs text-[var(--fg-muted)]">
                          ({pct}%)
                        </span>
                      </p>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                      <div
                        className={
                          i === 0
                            ? "h-full rounded-full bg-primary transition-all"
                            : "h-full rounded-full bg-primary/45 transition-all"
                        }
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      const res = await api<Dashboard>("/api/admin?resource=dashboard");
      setData(res.data || null);
    })();
  }, [router]);

  const weekly = useMemo(() => data?.weeklyOrders || [], [data]);

  if (!data) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  const stats = [
    { label: "Total Orders", value: data.totalOrders },
    { label: "Active", value: data.activeOrders },
    { label: "Completed", value: data.completedOrders },
    { label: "Revenue", value: data.revenue, money: true },
    { label: "Customers", value: data.customers },
  ];

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Ringkasan bisnis Laundry On-Demand
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-bold">
              {s.money ? <Money amount={s.value} /> : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-[var(--brand)]">
              Lihat semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--fg-muted)]">
                  <th className="pb-2 font-medium">Order</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Service</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-[var(--brand)]"
                      >
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-[var(--fg-muted)]">
                        {formatDateTime(o.createdAt)}
                      </p>
                    </td>
                    <td className="py-3">{o.customer.name}</td>
                    <td className="py-3">{o.service.name}</td>
                    <td className="py-3">
                      <Money amount={o.total} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={o.orderStatus} />
                    </td>
                  </tr>
                ))}
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-[var(--fg-muted)]"
                    >
                      Belum ada order
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <PopularServicesPanel items={data.popularServices} />
          </div>

          <div className="card p-5">
            <WeeklyOrdersChart data={weekly} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
