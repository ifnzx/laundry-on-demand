"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/order-status";

type OrderDetail = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  estimatedWeight: number;
  actualWeight?: number | null;
  pricePerKg: number;
  estimatedLaundryPrice: number;
  actualLaundryPrice?: number | null;
  distanceKm: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  pickupType: string;
  pickupDate?: string | null;
  pickupTimeStart?: string | null;
  pickupTimeEnd?: string | null;
  notes?: string | null;
  createdAt: string;
  service: { name: string };
  address: { label: string; address: string; recipientName: string; phone: string };
  outlet?: { name: string; phone: string } | null;
  courier?: {
    name: string;
    phone: string;
    vehicle?: string | null;
    rating: number;
  } | null;
  statusHistory: { status: string; note?: string | null; createdAt: string }[];
  payments: { id: string; amount: number; status: string; paymentType: string }[];
  rating?: { laundryRating: number; courierRating?: number | null; comment?: string | null } | null;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [laundryRating, setLaundryRating] = useState(5);
  const [courierRating, setCourierRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await api<OrderDetail>(`/api/orders?id=${id}`);
    if (!res.success) {
      router.push("/orders");
      return;
    }
    setOrder(res.data || null);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitRating() {
    setSubmitting(true);
    const res = await api("/api/orders", {
      method: "PUT",
      body: JSON.stringify({
        action: "rate",
        orderId: id,
        laundryRating,
        courierRating,
        comment,
      }),
    });
    setSubmitting(false);
    if (!res.success) {
      setMsg(res.error || "Gagal");
      return;
    }
    setMsg("Terima kasih atas rating Anda!");
    await load();
  }

  if (loading || !order) {
    return (
      <CustomerShell>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  const needsPayment =
    order.orderStatus === "pending_payment" ||
    order.orderStatus === "waiting_additional_payment";

  return (
    <CustomerShell>
      <div className="px-4 pt-6 pb-8">
        <Link href="/orders" className="text-sm text-[var(--brand)]">
          ← Riwayat
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              No. pesanan
            </p>
            <h1 className="mt-0.5 truncate font-mono text-base font-semibold tracking-tight text-on-surface sm:text-lg">
              {order.orderNumber}
            </h1>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="pt-0.5">
            <StatusBadge status={order.orderStatus} />
          </div>
        </div>

        {needsPayment && (
          <div className="card mt-4 border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              {order.orderStatus === "waiting_additional_payment"
                ? "Tagihan siap dibayar"
                : "Menunggu Pembayaran"}
            </p>
            {order.actualWeight != null && (
              <div className="mt-2 space-y-1 text-sm text-amber-900">
                <p>Berat aktual: {order.actualWeight} KG</p>
                <p>
                  Total laundry + ongkir:{" "}
                  <strong>{formatRupiah(order.remainingAmount)}</strong>
                </p>
              </div>
            )}
            <Link
              href={`/payment?orderId=${order.id}`}
              className="btn btn-primary mt-3 w-full"
            >
              Bayar Sekarang
            </Link>
          </div>
        )}

        <div className="card mt-4 space-y-2 p-4">
          <h2 className="font-semibold">Detail</h2>
          <Row label="Layanan" value={order.service.name} />
          {order.actualWeight != null ? (
            <Row label="Berat aktual" value={`${order.actualWeight} kg`} />
          ) : (
            <Row label="Berat" value="Ditimbang di outlet" />
          )}
          <Row label="Harga / kg" value={formatRupiah(order.pricePerKg)} />
          <Row
            label="Harga laundry"
            value={
              order.actualLaundryPrice != null
                ? formatRupiah(order.actualLaundryPrice)
                : order.estimatedLaundryPrice > 0
                  ? formatRupiah(order.estimatedLaundryPrice)
                  : "Setelah penimbangan"
            }
          />
          <Row label="Jarak" value={`${order.distanceKm} km`} />
          <Row label="Ongkir" value={formatRupiah(order.deliveryFee)} />
          {order.discount > 0 && (
            <Row label="Diskon" value={`- ${formatRupiah(order.discount)}`} />
          )}
          <Row label="Total" value={formatRupiah(order.total)} bold />
          <Row label="Dibayar" value={formatRupiah(order.paidAmount)} />
        </div>

        <div className="card mt-4 space-y-2 p-4">
          <h2 className="font-semibold">Pickup</h2>
          <Row label="Alamat" value={`${order.address.label} — ${order.address.address}`} />
          <Row
            label="Jadwal"
            value={
              order.pickupType === "pickup_now"
                ? "Sekarang"
                : `${order.pickupDate} ${order.pickupTimeStart}-${order.pickupTimeEnd}`
            }
          />
          {order.notes && <Row label="Catatan" value={order.notes} />}
        </div>

        {(order.courier || order.outlet) && (
          <div className="card mt-4 space-y-2 p-4">
            <h2 className="font-semibold">Tim Outlet</h2>
            {order.courier ? (
              <>
                <Row label="Nama" value={order.courier.name} />
                {order.courier.vehicle && (
                  <Row label="Kendaraan" value={order.courier.vehicle} />
                )}
                <Row label="Rating" value={`${order.courier.rating} ★`} />
              </>
            ) : (
              <Row label="Outlet" value={order.outlet!.name} />
            )}
            <Link
              href={`/orders/${order.id}/chat`}
              className="btn btn-primary mt-2 w-full"
            >
              Chat outlet
            </Link>
            <Link
              href={`/orders/${order.id}/tracking`}
              className="btn btn-secondary mt-2 w-full"
            >
              Lacak Status
            </Link>
          </div>
        )}

        {!order.courier && !order.outlet && order.orderStatus !== "pending_payment" && (
          <>
            <Link
              href={`/orders/${order.id}/chat`}
              className="btn btn-primary mt-4 w-full"
            >
              Chat outlet
            </Link>
            <Link
              href={`/orders/${order.id}/tracking`}
              className="btn btn-secondary mt-2 w-full"
            >
              Lacak Status
            </Link>
          </>
        )}

        <div className="card mt-4 p-4">
          <h2 className="font-semibold mb-3">Timeline</h2>
          <div className="space-y-3">
            {order.statusHistory.map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                <div>
                  <p className="text-sm font-medium">
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

        {(order.orderStatus === "delivered" ||
          order.orderStatus === "completed") &&
          !order.rating && (
            <div className="card mt-4 p-4">
              <h2 className="font-semibold">Berikan Rating</h2>
              <div className="mt-3">
                <label className="label">Rating Laundry</label>
                <select
                  className="input"
                  value={laundryRating}
                  onChange={(e) => setLaundryRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="label">Rating Tim / Pelayanan</label>
                <select
                  className="input"
                  value={courierRating}
                  onChange={(e) => setCourierRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="label">Komentar</label>
                <textarea
                  className="input min-h-[80px]"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              {msg && (
                <p className="mt-2 text-sm text-[var(--brand)]">{msg}</p>
              )}
              <button
                className="btn btn-primary mt-3 w-full"
                onClick={submitRating}
                disabled={submitting}
              >
                {submitting ? <Spinner /> : "Kirim Rating"}
              </button>
            </div>
          )}

        {order.rating && (
          <div className="card mt-4 p-4">
            <h2 className="font-semibold">Rating Anda</h2>
            <p className="mt-2 text-sm">
              Laundry: {order.rating.laundryRating} ★
              {order.rating.courierRating
                ? ` · Tim: ${order.rating.courierRating} ★`
                : ""}
            </p>
            {order.rating.comment && (
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                {order.rating.comment}
              </p>
            )}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[var(--fg-muted)] shrink-0">{label}</span>
      <span className={`text-right ${bold ? "font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
