"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { useI18n } from "@/i18n/context";

type Payment = {
  id: string;
  amount: number;
  status: string;
  paymentType: string;
  paymentMethod: string;
  paidAt?: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
  };
  user: { name: string; phone: string };
};

type UnpaidOrder = {
  id: string;
  orderNumber: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  orderStatus: string;
  paymentStatus: string;
  customer: { name: string; phone: string };
};

const METHODS = [
  { id: "cash", label: "Cash / Tunai" },
  { id: "qris", label: "QRIS" },
  { id: "bank_transfer", label: "Transfer Bank" },
  { id: "ewallet", label: "E-Wallet" },
  { id: "dana", label: "Dana" },
  { id: "gopay", label: "GoPay" },
  { id: "ovo", label: "OVO" },
  { id: "shopeepay", label: "ShopeePay" },
];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaid, setUnpaid] = useState<UnpaidOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Manual form
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [payRes, ordRes] = await Promise.all([
      api<Payment[]>("/api/payments"),
      api<UnpaidOrder[]>("/api/orders"),
    ]);
    setPayments(payRes.data || []);
    const list = (ordRes.data || []).filter(
      (o) =>
        o.remainingAmount > 0 ||
        o.paymentStatus === "pending" ||
        o.orderStatus === "pending_payment" ||
        o.orderStatus === "waiting_additional_payment"
    );
    setUnpaid(list);
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

  useEffect(() => {
    const selected = unpaid.find((o) => o.id === orderId);
    if (selected) {
      const rem =
        selected.remainingAmount > 0
          ? selected.remainingAmount
          : Math.max(0, selected.total - selected.paidAmount);
      setAmount(String(rem));
    }
  }, [orderId, unpaid]);

  async function confirmPayment(paymentId: string, paymentMethod?: string) {
    setBusyId(paymentId);
    setMsg("");
    const res = await api("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentId,
        paymentMethod: paymentMethod || "cash",
      }),
    });
    setBusyId(null);
    setMsg(res.success ? "Pembayaran dikonfirmasi" : res.error || "Gagal");
    await load();
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    setSaving(true);
    setMsg("");
    const res = await api("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        action: "record",
        orderId,
        amount: amount ? Number(amount) : undefined,
        paymentMethod: method,
        note: note || undefined,
      }),
    });
    setSaving(false);
    if (!res.success) {
      setMsg(res.error || "Gagal menyimpan");
      return;
    }
    setMsg("Pembayaran berhasil dicatat");
    setNote("");
    setOrderId("");
    setAmount("");
    await load();
  }

  const pending = payments.filter((p) => p.status === "pending");

  return (
    <AdminShell>
      <h1 className="text-3xl font-bold text-on-surface">
        {t("admin.nav.payments")}
      </h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Konfirmasi pembayaran customer atau catat bayar tunai/transfer di outlet.
      </p>
      <p className="mt-2">
        <Link
          href="/admin/payment-accounts"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Atur rekening · Dana · GoPay →
        </Link>
      </p>

      {msg && (
        <p className="mt-4 rounded-xl bg-primary-fixed px-4 py-2 text-sm text-primary">
          {msg}
        </p>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Record payment form */}
          <form
            onSubmit={recordPayment}
            className="card h-fit space-y-3 p-5 lg:col-span-1"
          >
            <h2 className="font-semibold text-lg">Catat Pembayaran</h2>
            <p className="text-xs text-on-surface-variant">
              Untuk bayar di tempat (cash/transfer) — admin input manual.
            </p>

            <div>
              <label className="label">Order (belum lunas)</label>
              <select
                className="input"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              >
                <option value="">Pilih order</option>
                {unpaid.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customer.name} (sisa{" "}
                    {formatRupiah(
                      o.remainingAmount > 0
                        ? o.remainingAmount
                        : Math.max(0, o.total - o.paidAmount)
                    )}
                    )
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Jumlah (Rp)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Otomatis sisa tagihan"
              />
            </div>

            <div>
              <label className="label">Metode</label>
              <select
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Catatan (opsional)</label>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: bayar cash di outlet"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={saving || !orderId}
            >
              {saving ? <Spinner /> : "Simpan Pembayaran"}
            </button>
          </form>

          <div className="space-y-6 lg:col-span-2">
            {/* Pending confirmations */}
            {pending.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 font-semibold">
                  Menunggu Konfirmasi ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
                    >
                      <div>
                        <Link
                          href={`/admin/orders/${p.order.id}`}
                          className="font-semibold text-primary"
                        >
                          {p.order.orderNumber}
                        </Link>
                        <p className="text-sm">
                          {p.user.name} · <Money amount={p.amount} /> ·{" "}
                          {p.paymentType}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {METHODS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="btn btn-secondary text-xs py-1.5 px-2"
                            disabled={busyId === p.id}
                            onClick={() => confirmPayment(p.id, m.id)}
                          >
                            {busyId === p.id ? <Spinner className="h-3 w-3 border-primary/30 border-t-primary" /> : m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* History table */}
            <section className="card overflow-x-auto">
              <div className="border-b border-outline-variant p-4">
                <h2 className="font-semibold">Riwayat Pembayaran</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="p-3">Order</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-outline-variant/50"
                    >
                      <td className="p-3">
                        <Link
                          href={`/admin/orders/${p.order.id}`}
                          className="font-medium text-primary"
                        >
                          {p.order.orderNumber}
                        </Link>
                      </td>
                      <td className="p-3">{p.user.name}</td>
                      <td className="p-3">
                        <Money amount={p.amount} />
                      </td>
                      <td className="p-3 capitalize">{p.paymentType}</td>
                      <td className="p-3">{p.paymentMethod}</td>
                      <td className="p-3">
                        <span
                          className={`badge ${
                            p.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {formatDateTime(p.paidAt || p.createdAt)}
                      </td>
                      <td className="p-3">
                        {p.status === "pending" ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary"
                            disabled={busyId === p.id}
                            onClick={() => confirmPayment(p.id, "cash")}
                          >
                            Konfirmasi cash
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-6 text-center text-on-surface-variant"
                      >
                        Belum ada data pembayaran
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
