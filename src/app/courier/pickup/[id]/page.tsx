"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CourierShell } from "@/components/courier-shell";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { LoadingBlock, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { osmMapUrl } from "@/lib/maps";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  distanceKm: number;
  pickupType: string;
  pickupDate?: string | null;
  pickupTimeStart?: string | null;
  pickupTimeEnd?: string | null;
  notes?: string | null;
  customer: { name: string; phone: string };
  address: {
    address: string;
    latitude: number;
    longitude: number;
    recipientName: string;
    phone: string;
  };
  service: { name: string };
};

export default function CourierPickupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await api<Order>(`/api/orders?id=${id}`);
    if (!res.success) {
      router.push("/courier/orders");
      return;
    }
    setOrder(res.data || null);
  }

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "courier") {
        router.push("/courier/login");
        return;
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(action: string) {
    setBusy(true);
    setMsg("");
    const res = await api("/api/courier", {
      method: "POST",
      body: JSON.stringify({
        action,
        orderId: id,
        pickupPhoto: action === "confirm_pickup" ? "pickup-proof-mvp" : undefined,
      }),
    });
    setBusy(false);
    setMsg(res.success ? "Berhasil" : res.error || "Gagal");
    if (res.success) await load();
  }

  if (!order) {
    return (
      <CourierShell>
        <LoadingBlock />
      </CourierShell>
    );
  }

  const mapsUrl = osmMapUrl(
    order.address.latitude,
    order.address.longitude
  );

  return (
    <CourierShell>
      <div className="px-4 pt-4 pb-8">
        <Link href="/courier/orders" className="text-sm text-[var(--brand)]">
          ← Orders
        </Link>
        <div className="mt-2 flex justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Pickup</h1>
          <StatusBadge status={order.orderStatus} />
        </div>
        <p className="text-sm text-[var(--fg-muted)]">{order.orderNumber}</p>

        <div className="card mt-4 space-y-2 p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Customer</p>
          <p className="font-semibold text-lg">{order.customer.name}</p>
          <a href={`tel:${order.customer.phone}`} className="text-[var(--brand)] font-medium">
            {order.customer.phone}
          </a>
          <p className="mt-2 text-sm">{order.address.address}</p>
          <p className="text-sm text-[var(--fg-muted)]">
            {order.distanceKm} km · {order.service.name}
          </p>
          <p className="text-sm text-[var(--fg-muted)]">
            Jadwal:{" "}
            {order.pickupType === "pickup_now"
              ? "Sekarang"
              : `${order.pickupDate} ${order.pickupTimeStart}-${order.pickupTimeEnd}`}
          </p>
          {order.notes && <p className="text-sm">Catatan: {order.notes}</p>}
          <div className="mt-3 overflow-hidden rounded-xl">
            <LeafletMapClient
              position={{
                lat: order.address.latitude,
                lng: order.address.longitude,
              }}
              height={180}
              zoom={15}
            />
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary mt-4 w-full"
        >
          Buka peta OSM
        </a>

        {msg && <p className="mt-3 text-sm text-[var(--brand)]">{msg}</p>}

        <div className="mt-4 space-y-2">
          {order.orderStatus === "courier_assigned" && (
            <>
              <button className="btn btn-primary w-full" disabled={busy} onClick={() => act("accept")}>
                {busy ? <Spinner /> : "Accept & Menuju Lokasi"}
              </button>
              <button className="btn btn-secondary w-full" disabled={busy} onClick={() => act("reject")}>
                Reject
              </button>
            </>
          )}
          {order.orderStatus === "courier_to_customer" && (
            <>
              <button className="btn btn-secondary w-full" disabled={busy} onClick={() => act("arrived")}>
                Tandai Tiba
              </button>
              <button className="btn btn-primary w-full" disabled={busy} onClick={() => act("confirm_pickup")}>
                {busy ? <Spinner /> : "Confirm Pickup + Foto"}
              </button>
            </>
          )}
          {order.orderStatus === "picked_up" && (
            <div className="card p-4 text-center text-sm text-[var(--fg-muted)]">
              Laundry sudah diambil. Serahkan ke outlet.
            </div>
          )}
        </div>
      </div>
    </CourierShell>
  );
}
