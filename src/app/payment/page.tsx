"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, Money, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatRupiah } from "@/lib/utils";
import {
  paymentAccountIcon,
  toPaymentMethodCode,
  type PaymentAccount,
} from "@/lib/payment-accounts";

type Order = {
  id: string;
  orderNumber: string;
  total: number;
  remainingAmount: number;
  orderStatus: string;
  paymentStatus: string;
  service: { name: string };
  estimatedWeight: number;
  actualWeight?: number | null;
  deliveryFee: number;
  discount: number;
  estimatedLaundryPrice: number;
  actualLaundryPrice?: number | null;
  payments: {
    id: string;
    amount: number;
    status: string;
    paymentType: string;
  }[];
};

function PaymentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId") || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [methodId, setMethodId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyNumber(value: string) {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = value.replace(/\s/g, "");
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("Order tidak valid");
      return;
    }
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const [ordRes, accRes] = await Promise.all([
        api<Order>(`/api/orders?id=${orderId}`),
        api<PaymentAccount[]>("/api/payments?resource=accounts"),
      ]);
      if (!ordRes.success || !ordRes.data) {
        setError(ordRes.error || "Order tidak ditemukan");
        setLoading(false);
        return;
      }
      setOrder(ordRes.data);
      const list = accRes.data || [];
      setAccounts(list);
      if (list[0]) setMethodId(list[0].id);
      setLoading(false);
    })();
  }, [orderId, router]);

  const selected = accounts.find((a) => a.id === methodId) || accounts[0];

  async function pay() {
    if (!order || paying || !selected) return;
    setPaying(true);
    setError("");
    const pending = order.payments.find((p) => p.status === "pending");
    const res = await api<{ order?: Order }>("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentId: pending?.id,
        orderId: order.id,
        paymentMethod: toPaymentMethodCode(selected),
      }),
    });
    setPaying(false);
    if (!res.success) {
      setError(res.error || "Pembayaran gagal");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push(`/orders/${order.id}`), 1200);
  }

  if (loading) {
    return (
      <CustomerShell hideNav>
        <LoadingBlock label="Memuat pembayaran..." />
      </CustomerShell>
    );
  }

  if (!order) {
    return (
      <CustomerShell hideNav>
        <div className="p-6 text-center">
          <p>{error || "Order tidak ditemukan"}</p>
          <Link href="/home" className="btn btn-primary mt-4">
            Beranda
          </Link>
        </div>
      </CustomerShell>
    );
  }

  const amount =
    order.payments.find((p) => p.status === "pending")?.amount ||
    order.remainingAmount ||
    order.total;

  const alreadyPaid =
    order.paymentStatus === "paid" ||
    (order.remainingAmount <= 0 &&
      order.orderStatus !== "pending_payment" &&
      order.orderStatus !== "waiting_additional_payment");

  return (
    <CustomerShell hideNav>
      <div className="px-4 pb-10 pt-6">
        <Link
          href={`/orders/${order.id}`}
          className="text-sm text-[var(--brand)]"
        >
          ← Detail order
        </Link>
        <h1 className="font-display mt-2 text-2xl font-semibold">
          Pembayaran
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {order.orderNumber}
        </p>

        {success ? (
          <div className="card mt-6 animate-fade-up p-8 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <h2 className="font-display text-xl font-semibold">
              Pembayaran dicatat
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Mengalihkan ke detail order...
            </p>
          </div>
        ) : alreadyPaid ? (
          <div className="card mt-6 p-6 text-center">
            <p className="font-semibold">Pesanan ini sudah dibayar</p>
            <Link
              href={`/orders/${order.id}`}
              className="btn btn-primary mt-4 inline-flex"
            >
              Lihat order
            </Link>
          </div>
        ) : (
          <>
            <div className="card mt-6 space-y-2 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Layanan</span>
                <span>{order.service.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Laundry</span>
                <span>
                  {order.actualLaundryPrice != null
                    ? formatRupiah(order.actualLaundryPrice)
                    : order.estimatedLaundryPrice > 0
                      ? formatRupiah(order.estimatedLaundryPrice)
                      : "Setelah penimbangan"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Ongkir</span>
                <span>{formatRupiah(order.deliveryFee)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Diskon</span>
                  <span>- {formatRupiah(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[var(--border)] pt-2 text-lg font-bold">
                <span>Bayar</span>
                <span className="text-[var(--brand)]">
                  <Money amount={amount} />
                </span>
              </div>
              <StatusBadge status={order.orderStatus} />
            </div>

            <div className="mt-6">
              <p className="label">Metode pembayaran</p>
              {accounts.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--fg-muted)]">
                  Belum ada metode aktif. Hubungi outlet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map((m) => {
                    const active = methodId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMethodId(m.id);
                          setError("");
                          setCopied(false);
                        }}
                        className={
                          active
                            ? "flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 border-primary bg-primary-fixed px-3 py-3 text-left shadow-sm"
                            : "flex cursor-pointer flex-col items-start gap-1 rounded-2xl border border-[var(--border)] bg-white px-3 py-3 text-left shadow-sm hover:border-primary/50"
                        }
                      >
                        <span
                          className={`material-symbols-outlined text-[22px] ${
                            active ? "text-primary" : "text-on-surface-variant"
                          }`}
                        >
                          {paymentAccountIcon(m.provider)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            active ? "text-primary" : "text-on-surface"
                          }`}
                        >
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selected && (
              <div className="card mt-4 p-4">
                <p className="text-sm font-semibold text-on-surface">
                  {selected.label}
                </p>
                {selected.accountNumber ? (
                  <div className="mt-2 rounded-xl bg-surface-container-high p-3 text-sm">
                    {selected.accountName && (
                      <p className="text-on-surface-variant">
                        a.n. {selected.accountName}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-base font-semibold tracking-wide text-on-surface">
                        {selected.accountNumber}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyNumber(selected.accountNumber)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5 active:scale-95"
                        aria-label="Salin nomor"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                            Salin
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : selected.provider === "qris" ? (
                  <div className="mx-auto mt-3 flex h-32 w-32 items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary-fixed/40 text-center text-xs text-primary">
                    QRIS
                    <br />
                    outlet
                  </div>
                ) : selected.provider === "cash" ? (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Siapkan uang tunai saat jemput atau antar.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Detail rekening belum diisi outlet.
                  </p>
                )}
                {selected.notes && (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {selected.notes}
                  </p>
                )}
                <p className="mt-3 text-xs text-on-surface-variant">
                  Transfer sesuai nominal, lalu tekan konfirmasi di bawah.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary mt-6 w-full py-3.5 text-base"
              onClick={pay}
              disabled={paying || amount <= 0 || !selected}
            >
              {paying ? (
                <>
                  <Spinner /> Memproses...
                </>
              ) : (
                `Konfirmasi bayar ${formatRupiah(amount)}`
              )}
            </button>
          </>
        )}
      </div>
    </CustomerShell>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <CustomerShell hideNav>
          <LoadingBlock />
        </CustomerShell>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}
