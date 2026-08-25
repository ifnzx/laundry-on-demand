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
  customer: { name: string; phone: string };
  address: {
    address: string;
    latitude: number;
    longitude: number;
    recipientName: string;
  };
  service: { name: string };
};

export default function CourierDeliveryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await api<Order>(`/api/orders?id=${id}`);
    if (!res.success) {
      router.push("/courier/orders");
      return;
    }
    setOrder(res.data || null);
    if (res.data?.address.recipientName) {
      setRecipientName(res.data.address.recipientName);
    }
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

  async function startDelivery() {
    setBusy(true);
    const res = await api("/api/courier", {
      method: "POST",
      body: JSON.stringify({ action: "start_delivery", orderId: id }),
    });
    setBusy(false);
    setMsg(res.success ? "Delivery dimulai" : res.error || "Gagal");
    await load();
  }

  async function confirmDelivery() {
    if (!recipientName.trim()) {
      setMsg("Nama penerima wajib");
      return;
    }
    setBusy(true);
    const res = await api("/api/courier", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm_delivery",
        orderId: id,
        recipientName,
        deliveryNote,
        deliveryPhoto: "delivery-proof-mvp",
      }),
    });
    setBusy(false);
    setMsg(res.success ? "Delivery selesai" : res.error || "Gagal");
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
        <div className="mt-2 flex justify-between">
          <h1 className="font-display text-2xl font-semibold">Delivery</h1>
          <StatusBadge status={order.orderStatus} />
        </div>
        <p className="text-sm text-[var(--fg-muted)]">{order.orderNumber}</p>

        <div className="card mt-4 p-4">
          <p className="font-semibold text-lg">{order.customer.name}</p>
          <p className="text-sm">{order.address.address}</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {order.distanceKm} km · {order.service.name}
          </p>
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

        <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-secondary mt-4 w-full">
          Buka peta OSM
        </a>

        {msg && <p className="mt-3 text-sm text-[var(--brand)]">{msg}</p>}

        {order.orderStatus === "ready_for_delivery" && (
          <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={startDelivery}>
            {busy ? <Spinner /> : "Mulai Pengantaran"}
          </button>
        )}

        {order.orderStatus === "courier_to_customer_delivery" && (
          <div className="card mt-4 space-y-3 p-4">
            <h3 className="font-semibold">Bukti Pengantaran</h3>
            <div>
              <label className="label">Nama Penerima</label>
              <input
                className="input"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Catatan</label>
              <input
                className="input"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              MVP: foto disimpan sebagai bukti marker (integrasi upload nanti)
            </p>
            <button className="btn btn-primary w-full" disabled={busy} onClick={confirmDelivery}>
              {busy ? <Spinner /> : "Confirm Delivery"}
            </button>
          </div>
        )}

        {order.orderStatus === "delivered" && (
          <div className="card mt-4 p-6 text-center">
            <p className="text-3xl">✓</p>
            <p className="mt-2 font-semibold">Delivery selesai</p>
          </div>
        )}
      </div>
    </CourierShell>
  );
}
