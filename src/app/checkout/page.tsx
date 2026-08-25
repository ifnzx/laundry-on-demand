"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import {
  clearBookingDraft,
  getBookingDraft,
  setBookingDraft,
  serviceVisual,
} from "@/lib/booking-draft";
import { formatRupiah } from "@/lib/utils";

type Quote = {
  serviceName: string;
  servicePrice: number;
  pricingType: string;
  estimatedWeight: number;
  estimatedLaundryPrice: number;
  laundryPriceDeferred: boolean;
  distanceKm: number;
  deliveryFee: number;
  discount: number;
  subtotal: number;
  total: number;
  outletName: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(getBookingDraft());

  async function loadQuote(code?: string) {
    const d = getBookingDraft();
    if (!d.serviceId || !d.addressId) {
      return { ok: false as const, error: "Data booking tidak lengkap" };
    }
    setQuoteLoading(true);
    setError("");
    const res = await api<Quote>("/api/orders/quote", {
      method: "POST",
      body: JSON.stringify({
        serviceId: d.serviceId,
        addressId: d.addressId,
        promoCode: code || undefined,
        itemQty: d.itemQty,
      }),
    });
    setQuoteLoading(false);
    if (!res.success) {
      setQuote(null);
      setError(res.error || "Gagal menghitung harga");
      return { ok: false as const, error: res.error };
    }
    setQuote(res.data || null);
    return { ok: true as const };
  }

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const d = getBookingDraft();
      if (!d.serviceId || !d.addressId) {
        router.replace("/booking");
        return;
      }
      setDraft(d);
      if (d.promoCode) setPromoCode(d.promoCode);
      await loadQuote(d.promoCode);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    setPromoCode(code);
    setBookingDraft({ promoCode: code || undefined });
    await loadQuote(code || undefined);
  }

  async function payNow() {
    const d = getBookingDraft();
    if (!d.serviceId || !d.addressId) return;
    setSubmitting(true);
    setError("");
    const res = await api<{ id: string; orderStatus: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        serviceId: d.serviceId,
        addressId: d.addressId,
        pickupType: d.pickupType || "pickup_now",
        pickupDate: d.pickupDate,
        pickupTimeStart: d.pickupTimeStart,
        pickupTimeEnd: d.pickupTimeEnd,
        promoCode: promoCode.trim() || undefined,
        notes: d.notes,
        itemQty: d.itemQty,
      }),
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || "Gagal membuat order");
      return;
    }
    clearBookingDraft();
    const order = res.data!;
    if (order.orderStatus === "pending_payment") {
      router.push(`/payment?orderId=${order.id}`);
    } else {
      router.push(`/orders/${order.id}`);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingBlock label="Menghitung jarak..." />
      </div>
    );
  }

  const visual = serviceVisual(quote?.serviceName || draft.serviceName || "");
  const deferred = quote?.laundryPriceDeferred ?? true;
  const perItem = quote?.pricingType === "per_item";
  const itemCount = Math.max(
    1,
    Math.round(quote?.estimatedWeight || draft.itemQty || 1)
  );

  return (
    <div className="min-h-screen bg-background pb-28 text-on-background">
      <header className="flex h-14 w-full items-center justify-between border-b border-outline-variant/40 bg-surface px-4">
        <button
          type="button"
          onClick={() => router.push("/booking/address")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant/50"
          aria-label="Kembali"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold text-on-surface">Checkout</h1>
        <div className="w-9" />
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {error && (
          <p className="rounded-xl bg-error-container px-3 py-2.5 text-sm text-on-error-container">
            {error}
          </p>
        )}

        <section className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface">
            Ringkasan pesanan
          </h2>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined fill text-[22px]">
                {visual.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-snug text-on-surface">
                {quote?.serviceName || draft.serviceName}
              </h3>
              <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                {deferred
                  ? "Harga laundry setelah penimbangan di outlet"
                  : perItem
                    ? `${itemCount} item × ${formatRupiah(quote?.servicePrice || 0)}`
                    : "Harga paket tetap"}
              </p>
            </div>
          </div>
          <hr className="border-outline-variant/40" />
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-on-surface-variant">Laundry</span>
              <span className="font-medium tabular-nums text-on-surface">
                {quoteLoading
                  ? "..."
                  : deferred
                    ? "Setelah timbang"
                    : formatRupiah(quote?.estimatedLaundryPrice || 0)}
              </span>
            </div>
            {deferred && quote && (
              <p className="text-[11px] leading-snug text-on-surface-variant">
                Tarif {formatRupiah(quote.servicePrice)}/kg · dihitung setelah
                ditimbang
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-on-surface-variant">
                Antar-jemput
                {quote ? ` · ${quote.distanceKm} km` : ""}
              </span>
              <span className="font-medium tabular-nums text-on-surface">
                {quoteLoading ? "..." : formatRupiah(quote?.deliveryFee || 0)}
              </span>
            </div>
            {deferred && (
              <p className="text-[11px] leading-snug text-on-surface-variant">
                Estimasi ongkir — dibayar bersama laundry setelah penimbangan
              </p>
            )}
          </div>
        </section>

        <section className="space-y-1.5">
          <label
            className="block text-xs font-medium text-on-surface-variant"
            htmlFor="promo_code"
          >
            Kode promo
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                local_offer
              </span>
              <input
                id="promo_code"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-outline/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Masukkan kode promo"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              />
            </div>
            <button
              type="button"
              onClick={applyPromo}
              disabled={quoteLoading}
              className="shrink-0 rounded-xl border border-primary px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              Terapkan
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface">
            Rincian pembayaran
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-on-surface-variant">
                {deferred ? "Bayar sekarang" : "Subtotal"}
              </span>
              <span className="font-medium tabular-nums text-on-surface">
                {formatRupiah(quote?.total || 0)}
              </span>
            </div>
            {(quote?.discount || 0) > 0 && (
              <div className="flex items-center justify-between gap-3 text-tertiary">
                <span>Diskon</span>
                <span className="font-medium tabular-nums">
                  -{formatRupiah(quote?.discount || 0)}
                </span>
              </div>
            )}
          </div>
          <hr className="border-outline-variant/40" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-on-surface">Total</span>
            <span className="text-lg font-bold tabular-nums tracking-tight text-primary">
              {deferred ? "—" : formatRupiah(quote?.total || 0)}
            </span>
          </div>
          {deferred && (
            <p className="rounded-lg bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed text-on-surface-variant">
              Laundry dan ongkir dibayar sekaligus setelah ditimbang di outlet.
            </p>
          )}
          {quote && (
            <p className="text-[11px] text-on-surface-variant">
              Outlet: {quote.outletName}
            </p>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant/30 bg-surface p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={payNow}
            disabled={!quote || submitting || quoteLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Spinner /> Membuat pesanan...
              </>
            ) : (
              <>
                <span>
                  {deferred
                    ? "Pesan sekarang"
                    : (quote?.total || 0) > 0
                      ? "Bayar & pesan"
                      : "Pesan sekarang"}
                </span>
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
