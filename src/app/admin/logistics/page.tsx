"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { osmPlaceUrl } from "@/lib/maps";
import {
  DELIVERY_QUEUE_STATUSES,
  PICKUP_QUEUE_STATUSES,
  STATUS_LABELS,
} from "@/lib/order-status";
import { formatDateTime } from "@/lib/utils";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  distanceKm: number;
  pickupType: string;
  pickupDate?: string | null;
  pickupTimeStart?: string | null;
  estimatedWeight: number;
  actualWeight?: number | null;
  createdAt: string;
  customer: { name: string; phone: string };
  service: { name: string };
  address: {
    address: string;
    recipientName?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    notes?: string | null;
  };
  outlet?: {
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  courier?: { name: string } | null;
};

function pickupLabel(o: Order) {
  if (o.pickupType === "scheduled" && o.pickupDate) {
    return `Terjadwal ${o.pickupDate}${
      o.pickupTimeStart ? ` · ${o.pickupTimeStart}` : ""
    }`;
  }
  return "Jemput segera";
}

export default function AdminLogisticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pickup" | "delivery">("pickup");
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const res = await api<Order[]>("/api/orders");
    setAllOrders(res.data || []);
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

  const pickupStatuses = PICKUP_QUEUE_STATUSES as readonly string[];
  const deliveryStatuses = DELIVERY_QUEUE_STATUSES as readonly string[];

  const pickupCount = allOrders.filter((o) =>
    pickupStatuses.includes(o.orderStatus)
  ).length;
  const deliveryCount = allOrders.filter((o) =>
    deliveryStatuses.includes(o.orderStatus)
  ).length;

  const orders = useMemo(() => {
    const statuses = tab === "pickup" ? pickupStatuses : deliveryStatuses;
    const term = q.trim().toLowerCase();
    return allOrders
      .filter((o) => statuses.includes(o.orderStatus))
      .filter((o) => {
        if (!term) return true;
        return (
          o.orderNumber.toLowerCase().includes(term) ||
          o.customer.name.toLowerCase().includes(term) ||
          o.customer.phone.toLowerCase().includes(term) ||
          o.address.address.toLowerCase().includes(term) ||
          o.service.name.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [allOrders, tab, q, pickupStatuses, deliveryStatuses]);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Jemput & Antar
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Antrian logistik outlet — urutan terdekat dulu
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={load}
        >
          Muat ulang
        </button>
      </div>

      {/* Tabs — badge nomor di pojok luar (atas kanan) tombol */}
      <div className="mt-5 grid grid-cols-2 gap-3" role="tablist">
        {(
          [
            {
              key: "pickup" as const,
              label: "Antrian jemput",
              count: pickupCount,
            },
            {
              key: "delivery" as const,
              label: "Antrian antar",
              count: deliveryCount,
            },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <div key={item.key} className="relative pt-2 pr-2">
              {item.count > 0 && (
                <span
                  className="absolute right-0 top-0 z-10 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-primary px-1.5 text-xs font-bold tabular-nums text-on-primary shadow-md"
                  aria-hidden
                >
                  {item.count}
                </span>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${item.label}, ${item.count} order`}
                onClick={() => setTab(item.key)}
                className={
                  active
                    ? "w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-on-primary shadow-sm"
                    : "w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 text-sm font-semibold text-[var(--fg-muted)] hover:border-primary/30"
                }
              >
                {item.label}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="log-q">
          Cari di antrian
        </label>
        <input
          id="log-q"
          className="input max-w-md"
          placeholder="No. order, nama, alamat, telepon..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : orders.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-[var(--fg-muted)]">
          {q
            ? "Tidak ada order yang cocok dengan pencarian."
            : tab === "pickup"
              ? "Tidak ada order di antrian jemput."
              : "Tidak ada order di antrian antar."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o, index) => {
            const hasCoords =
              o.address.latitude != null && o.address.longitude != null;
            const maps = osmPlaceUrl({
              lat: o.address.latitude,
              lng: o.address.longitude,
              address: o.address.address,
            });
            return (
              <li key={o.id}>
                <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand)]">
                          {index + 1}
                        </span>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-sm font-bold text-[var(--brand)] hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </div>
                      <p className="mt-1 text-xs text-[var(--fg-muted)]">
                        {formatDateTime(o.createdAt)}
                        {tab === "pickup" ? ` · ${pickupLabel(o)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={o.orderStatus} />
                  </div>

                  {/* Body grid */}
                  <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                        Customer
                      </p>
                      <p className="mt-0.5 text-sm font-semibold break-words">
                        {o.customer.name}
                      </p>
                      <a
                        href={`tel:${o.customer.phone}`}
                        className="text-sm font-medium text-[var(--brand)]"
                      >
                        {o.customer.phone}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                        Layanan
                      </p>
                      <p className="mt-0.5 text-sm font-semibold break-words">
                        {o.service.name}
                      </p>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {o.actualWeight != null
                          ? `${o.actualWeight} kg (aktual)`
                          : `Est. ${o.estimatedWeight} kg`}
                        {" · "}
                        <span className="tabular-nums font-medium text-[var(--fg)]">
                          {o.distanceKm.toFixed(1)} km
                        </span>
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                        {tab === "pickup"
                          ? "Alamat jemput"
                          : "Alamat antar"}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug break-words text-[var(--fg)]">
                        {o.address.address}
                      </p>
                      {o.address.notes ? (
                        <p className="mt-1 text-xs text-[var(--fg-muted)]">
                          Catatan: {o.address.notes}
                        </p>
                      ) : null}
                      {hasCoords && (
                        <div className="mt-2 overflow-hidden rounded-xl">
                          {o.outlet ? (
                            <LeafletMapClient
                              origin={{
                                lat: o.outlet.latitude,
                                lng: o.outlet.longitude,
                              }}
                              destination={{
                                lat: o.address.latitude!,
                                lng: o.address.longitude!,
                              }}
                              originLabel={
                                tab === "pickup"
                                  ? `Outlet: ${o.outlet.name}`
                                  : `Outlet: ${o.outlet.name}`
                              }
                              destinationLabel={
                                tab === "pickup"
                                  ? "Titik jemput customer"
                                  : "Titik antar customer"
                              }
                              height={200}
                              showCoords={false}
                            />
                          ) : (
                            <LeafletMapClient
                              position={{
                                lat: o.address.latitude!,
                                lng: o.address.longitude!,
                              }}
                              height={160}
                              zoom={15}
                              showCoords
                            />
                          )}
                        </div>
                      )}
                      {o.outlet && hasCoords && (
                        <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                          Rute: {o.outlet.name} → alamat customer
                          {tab === "pickup" ? " (penjemputan)" : " (pengantaran)"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    <a
                      href={`tel:${o.customer.phone}`}
                      className="btn btn-secondary !px-3 !py-2 text-sm"
                    >
                      Telepon
                    </a>
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary !px-3 !py-2 text-sm"
                      >
                        Buka peta OSM
                      </a>
                    )}
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="btn btn-primary !px-3 !py-2 text-sm"
                    >
                      Proses order
                    </Link>
                  </div>

                  <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
                    Status: {STATUS_LABELS[o.orderStatus] || o.orderStatus}
                    {o.courier?.name ? ` · Handler: ${o.courier.name}` : ""}
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
