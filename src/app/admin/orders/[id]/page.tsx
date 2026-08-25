"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { LoadingBlock, Money, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { osmPlaceUrl } from "@/lib/maps";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { STATUS_TRANSITIONS } from "@/lib/order-status";
import { useI18n } from "@/i18n/context";

type Order = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  estimatedWeight: number;
  actualWeight?: number | null;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  distanceKm: number;
  deliveryFee: number;
  pickupType: string;
  pickupDate?: string | null;
  pickupTimeStart?: string | null;
  notes?: string | null;
  service: { name: string };
  customer: { name: string; phone: string };
  address: {
    address: string;
    recipientName: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  };
  outlet?: {
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  courier?: { id: string; name: string; phone: string } | null;
  statusHistory: { status: string; note?: string | null; createdAt: string }[];
  payments: {
    id?: string;
    amount: number;
    status: string;
    paymentType: string;
    paymentMethod?: string;
  }[];
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, ts } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [actualWeight, setActualWeight] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");

  async function load() {
    const res = await api<Order>(`/api/orders?id=${id}`);
    if (!res.success || !res.data) {
      router.push("/admin/orders");
      return;
    }
    setOrder(res.data);
    setRecipientName(res.data.address.recipientName || "");
    const rem =
      res.data.remainingAmount > 0
        ? res.data.remainingAmount
        : Math.max(0, res.data.total - res.data.paidAmount);
    setPayAmount(rem > 0 ? String(rem) : "");
    const allowed = STATUS_TRANSITIONS[res.data.orderStatus] || [];
    setNextStatus(allowed[0] || "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function logistics(step: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({
        action: "logistics",
        orderId: id,
        step,
        takeOver: true,
        ...extra,
      }),
    });
    setBusy(false);
    setMsg(res.success ? t("admin.updated") : res.error || t("admin.failed"));
    await load();
  }

  async function weigh() {
    setBusy(true);
    setMsg("");
    const res = await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({
        action: "weigh",
        orderId: id,
        actualWeight: Number(actualWeight),
      }),
    });
    setBusy(false);
    setMsg(
      res.success
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res.data as any)?.requiresPayment
          ? t("admin.weightExtra")
          : t("admin.weightOk")
        : res.error || t("admin.failed")
    );
    await load();
  }

  async function updateStatus() {
    if (!nextStatus) return;
    setBusy(true);
    const res = await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({
        action: "update_status",
        orderId: id,
        status: nextStatus,
      }),
    });
    setBusy(false);
    setMsg(res.success ? t("admin.statusUpdated") : res.error || t("admin.failed"));
    await load();
  }

  async function cancel() {
    if (!confirm(t("admin.cancelOrder") + "?")) return;
    setBusy(true);
    const res = await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({
        action: "cancel",
        orderId: id,
        note: "Dibatalkan admin",
      }),
    });
    setBusy(false);
    setMsg(res.success ? t("admin.cancelled") : res.error || t("admin.failed"));
    await load();
  }

  async function recordPayment() {
    setBusy(true);
    setMsg("");
    const res = await api("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        action: "record",
        orderId: id,
        amount: payAmount ? Number(payAmount) : undefined,
        paymentMethod: payMethod,
        note: `Dicatat dari detail order (${payMethod})`,
      }),
    });
    setBusy(false);
    setMsg(
      res.success
        ? "Pembayaran berhasil dicatat"
        : res.error || t("admin.failed")
    );
    await load();
  }

  async function confirmPendingPayment(paymentId?: string) {
    setBusy(true);
    setMsg("");
    const res = await api("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentId,
        orderId: id,
        paymentMethod: payMethod,
      }),
    });
    setBusy(false);
    setMsg(
      res.success
        ? "Pembayaran dikonfirmasi"
        : res.error || t("admin.failed")
    );
    await load();
  }

  if (!order) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  const allowed = STATUS_TRANSITIONS[order.orderStatus] || [];
  const mapsUrl = osmPlaceUrl({
    lat: order.address.latitude,
    lng: order.address.longitude,
    address: order.address.address,
  });
  const hasCoords =
    order.address.latitude != null && order.address.longitude != null;

  const isPickupPhase = [
    "waiting_courier",
    "courier_assigned",
    "courier_to_customer",
  ].includes(order.orderStatus);

  const isDeliveryPhase = [
    "ready_for_delivery",
    "courier_to_customer_delivery",
  ].includes(order.orderStatus);

  return (
    <AdminShell>
      <Link href="/admin/orders" className="text-sm text-primary">
        ← Orders
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">{order.orderNumber}</h1>
          <p className="text-sm text-on-surface-variant">{order.service.name}</p>
        </div>
        <StatusBadge status={order.orderStatus} />
      </div>

      {msg && (
        <p className="mt-4 rounded-xl bg-primary-fixed px-4 py-2 text-sm text-primary">
          {msg}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-on-surface-variant">Customer</p>
              <p className="font-semibold">{order.customer.name}</p>
              <a
                href={`tel:${order.customer.phone}`}
                className="text-sm text-primary"
              >
                {order.customer.phone}
              </a>
              <Link
                href={`/admin/messages?orderId=${order.id}`}
                className="mt-2 inline-flex text-sm font-semibold text-primary"
              >
                Buka chat →
              </Link>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-on-surface-variant">Alamat</p>
              <p className="font-semibold">{order.address.recipientName}</p>
              <p className="text-sm">{order.address.address}</p>
              {hasCoords ? (
                <div className="mt-2 overflow-hidden rounded-xl">
                  {order.outlet ? (
                    <LeafletMapClient
                      origin={{
                        lat: order.outlet.latitude,
                        lng: order.outlet.longitude,
                      }}
                      destination={{
                        lat: order.address.latitude!,
                        lng: order.address.longitude!,
                      }}
                      originLabel={`Outlet: ${order.outlet.name}`}
                      destinationLabel={
                        isDeliveryPhase
                          ? "Titik antar customer"
                          : "Titik jemput customer"
                      }
                      height={240}
                      showCoords={false}
                    />
                  ) : (
                    <LeafletMapClient
                      position={{
                        lat: order.address.latitude!,
                        lng: order.address.longitude!,
                      }}
                      height={200}
                      zoom={15}
                    />
                  )}
                </div>
              ) : null}
              {order.outlet && hasCoords && (
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Rute dari {order.outlet.name} ke alamat customer
                  {isDeliveryPhase
                    ? " (pengantaran)"
                    : isPickupPhase
                      ? " (penjemputan)"
                      : ""}
                </p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-primary"
                >
                  Buka di OpenStreetMap →
                </a>
              )}
            </div>
            <div>
              <p className="text-xs uppercase text-on-surface-variant">
                Berat / Jarak
              </p>
              <p className="font-semibold">
                {order.actualWeight != null
                  ? `Aktual ${order.actualWeight} kg`
                  : "Belum ditimbang"}
              </p>
              <p className="text-sm">{order.distanceKm} km</p>
            </div>
            <div>
              <p className="text-xs uppercase text-on-surface-variant">
                Pembayaran
              </p>
              <p className="font-semibold">
                <Money amount={order.total} />
              </p>
              <p className="text-sm">
                Paid {formatRupiah(order.paidAmount)} · Sisa{" "}
                {formatRupiah(order.remainingAmount)}
              </p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Timeline</h2>
            <div className="space-y-3">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium">
                      {ts(h.status)}
                    </p>
                    {h.note && (
                      <p className="text-on-surface-variant">{h.note}</p>
                    )}
                    <p className="text-xs text-on-surface-variant">
                      {formatDateTime(h.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Payment entry */}
          {(order.remainingAmount > 0 ||
            order.paymentStatus === "pending" ||
            order.orderStatus === "pending_payment" ||
            order.orderStatus === "waiting_additional_payment" ||
            order.payments.some((p) => p.status === "pending")) && (
            <div className="card space-y-3 p-4">
              <h3 className="font-semibold">Catat / Konfirmasi Bayar</h3>
              <p className="text-xs text-on-surface-variant">
                Total <Money amount={order.total} /> · Lunas{" "}
                {formatRupiah(order.paidAmount)} · Sisa{" "}
                {formatRupiah(
                  order.remainingAmount > 0
                    ? order.remainingAmount
                    : Math.max(0, order.total - order.paidAmount)
                )}
              </p>
              <div>
                <label className="label">Metode</label>
                <select
                  className="input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="cash">Cash / Tunai</option>
                  <option value="qris">QRIS</option>
                  <option value="bank_transfer">Transfer Bank</option>
                  <option value="ewallet">E-Wallet</option>
                </select>
              </div>
              <div>
                <label className="label">Jumlah (Rp)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              {order.payments.some((p) => p.status === "pending") && (
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  disabled={busy}
                  onClick={() =>
                    confirmPendingPayment(
                      order.payments.find((p) => p.status === "pending")?.id
                    )
                  }
                >
                  {busy ? <Spinner /> : "Konfirmasi bayar pending"}
                </button>
              )}
              {(order.remainingAmount > 0 ||
                order.orderStatus === "pending_payment" ||
                order.orderStatus === "waiting_additional_payment") && (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={busy}
                  onClick={recordPayment}
                >
                  {busy ? <Spinner /> : "Catat pembayaran"}
                </button>
              )}
            </div>
          )}

          {/* Unified ops: Pickup */}
          {isPickupPhase && (
            <div className="card space-y-3 p-4">
              <h3 className="font-semibold">{t("admin.opsPickup")}</h3>
              <p className="text-xs text-on-surface-variant">
                {t("admin.opsPickupHint")}
              </p>
              {(order.orderStatus === "waiting_courier" ||
                order.orderStatus === "courier_assigned") && (
                <button
                  className="btn btn-primary w-full"
                  disabled={busy}
                  onClick={() => logistics("start_pickup")}
                >
                  {busy ? <Spinner /> : t("admin.startPickup")}
                </button>
              )}
              <button
                className="btn btn-secondary w-full"
                disabled={busy}
                onClick={() =>
                  logistics("confirm_pickup", {
                    pickupPhoto: "pickup-proof-admin",
                  })
                }
              >
                {busy ? <Spinner /> : t("admin.confirmPickup")}
              </button>
            </div>
          )}

          {order.orderStatus === "picked_up" && (
            <div className="card p-4">
              <button
                className="btn btn-primary w-full"
                onClick={() => logistics("receive_outlet")}
                disabled={busy}
              >
                {busy ? <Spinner /> : t("admin.receiveOutlet")}
              </button>
            </div>
          )}

          {(order.orderStatus === "received_at_outlet" ||
            order.orderStatus === "weighing") && (
            <div className="card space-y-3 p-4">
              <h3 className="font-semibold">{t("admin.weighing")}</h3>
              <input
                className="input"
                type="number"
                step="0.1"
                placeholder={t("admin.actualWeight")}
                value={actualWeight}
                onChange={(e) => setActualWeight(e.target.value)}
              />
              <button
                className="btn btn-primary w-full"
                onClick={weigh}
                disabled={busy || !actualWeight}
              >
                {busy ? <Spinner /> : t("admin.saveWeight")}
              </button>
            </div>
          )}

          {/* Unified ops: Delivery */}
          {isDeliveryPhase && (
            <div className="card space-y-3 p-4">
              <h3 className="font-semibold">{t("admin.opsDelivery")}</h3>
              {order.orderStatus === "ready_for_delivery" && (
                <button
                  className="btn btn-primary w-full"
                  disabled={busy}
                  onClick={() => logistics("start_delivery")}
                >
                  {busy ? <Spinner /> : t("admin.startDelivery")}
                </button>
              )}
              <div>
                <label className="label">{t("admin.recipientName")}</label>
                <input
                  className="input"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <button
                className="btn btn-secondary w-full"
                disabled={busy || !recipientName.trim()}
                onClick={() =>
                  logistics("confirm_delivery", {
                    recipientName,
                    deliveryPhoto: "delivery-proof-admin",
                  })
                }
              >
                {busy ? <Spinner /> : t("admin.confirmDelivered")}
              </button>
            </div>
          )}

          {allowed.length > 0 && (
            <div className="card space-y-3 p-4">
              <h3 className="font-semibold">{t("admin.manualStatus")}</h3>
              <select
                className="input"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
              >
                {allowed.map((s) => (
                  <option key={s} value={s}>
                    {ts(s)}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary w-full"
                onClick={updateStatus}
                disabled={busy}
              >
                {t("admin.changeStatus")}
              </button>
            </div>
          )}

          {order.orderStatus !== "completed" &&
            order.orderStatus !== "cancelled" && (
              <button
                className="btn w-full border border-red-200 bg-red-50 text-red-600"
                onClick={cancel}
              >
                {t("admin.cancelOrder")}
              </button>
            )}
        </div>
      </div>
    </AdminShell>
  );
}
