"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";

type Invoice = {
  id: string;
  yearMonth: string;
  totalAmount: number;
  feeCount: number;
  status: string;
  dueAt: string;
  paidAt: string | null;
  paidNote: string | null;
};

type BillingSummary = {
  locked: boolean;
  feePerOrder: number;
  currentYearMonth: string;
  unpaidTotal: number;
  unpaidInvoices: Invoice[];
  invoices: Invoice[];
  currentMonth: {
    yearMonth: string;
    totalAmount: number;
    feeCount: number;
    status: string;
  } | null;
  lockReason: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Berjalan",
  due: "Menunggu bayar",
  overdue: "Tertunggak",
  paid: "Lunas",
  waived: "Dibebaskan",
};

export default function AdminBillingPage() {
  const router = useRouter();
  const [data, setData] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await api<{ role: string }>("/api/auth");
    if (!me.success || me.data?.role !== "admin") {
      router.push("/admin/login");
      return;
    }
    const res = await api<BillingSummary>("/api/admin?resource=billing");
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function payInvoice(id: string) {
    setPayingId(id);
    setMsg(null);
    const res = await api<BillingSummary>("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "mark_platform_invoice_paid",
        invoiceId: id,
        note: "Pembayaran fee SaaS dicatat",
      }),
    });
    setPayingId(null);
    if (!res.success) {
      setMsg(res.error || "Gagal menandai lunas");
      return;
    }
    setMsg(
      "Tagihan ditandai lunas. Sistem dibuka kembali jika tidak ada tunggakan lain."
    );
    if (res.data) setData(res.data);
    else await load();
  }

  if (loading || !data) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Tagihan SaaS</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Fee platform ditetapkan developer:{" "}
        <span className="font-medium text-[var(--fg)]">
          Rp {data.feePerOrder.toLocaleString("id-ID")}
        </span>{" "}
        per transaksi (saat pembayaran pertama order berhasil) — ditagih
        kumulatif di akhir bulan.
      </p>

      {data.locked && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Sistem terkunci</p>
          <p className="mt-1">{data.lockReason}</p>
          <p className="mt-1 text-red-800/80">
            Pesanan baru dan operasi laundry dihentikan sementara sampai
            tagihan dilunasi.
          </p>
        </div>
      )}

      {!data.locked && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Sistem aktif. Fee bulan ini menumpuk hingga jatuh tempo akhir bulan.
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--brand)]">{msg}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">
            Fee / order (platform)
          </p>
          <p className="mt-2 text-2xl font-bold">
            <Money amount={data.feePerOrder} />
          </p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            Hanya dapat diubah oleh developer
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">
            Bulan ini ({data.currentYearMonth})
          </p>
          <p className="mt-2 text-2xl font-bold">
            <Money amount={data.currentMonth?.totalAmount || 0} />
          </p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            {data.currentMonth?.feeCount || 0} transaksi
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Tunggakan</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            <Money amount={data.unpaidTotal} />
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Status</p>
          <p className="mt-2 text-2xl font-bold">
            {data.locked ? "Terkunci" : "Aktif"}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Invoice bulanan</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[#f8fafb] text-xs uppercase text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Transaksi</th>
                <th className="px-4 py-3">Total fee</th>
                <th className="px-4 py-3">Jatuh tempo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.invoices.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[var(--fg-muted)]"
                  >
                    Belum ada invoice. Fee muncul saat order diselesaikan.
                  </td>
                </tr>
              )}
              {data.invoices.map((inv) => {
                const showPay =
                  inv.totalAmount > 0 &&
                  ["due", "overdue"].includes(inv.status);

                return (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{inv.yearMonth}</td>
                    <td className="px-4 py-3">{inv.feeCount}</td>
                    <td className="px-4 py-3">
                      <Money amount={inv.totalAmount} />
                    </td>
                    <td className="px-4 py-3 text-[var(--fg-muted)]">
                      {new Date(inv.dueAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          inv.status === "paid"
                            ? "text-emerald-700"
                            : inv.status === "due" || inv.status === "overdue"
                              ? "font-semibold text-red-700"
                              : "text-[var(--fg-muted)]"
                        }
                      >
                        {STATUS_LABEL[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showPay && (
                        <button
                          type="button"
                          className="btn btn-primary text-xs"
                          disabled={payingId === inv.id}
                          onClick={() => payInvoice(inv.id)}
                        >
                          {payingId === inv.id ? "..." : "Tandai lunas"}
                        </button>
                      )}
                      {inv.status === "paid" && inv.paidAt && (
                        <span className="text-xs text-[var(--fg-muted)]">
                          {new Date(inv.paidAt).toLocaleDateString("id-ID")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          Setelah akhir bulan, invoice berstatus &quot;Menunggu bayar&quot;.
          Selama belum ditandai lunas, sistem terkunci otomatis.
        </p>
      </section>
    </AdminShell>
  );
}
