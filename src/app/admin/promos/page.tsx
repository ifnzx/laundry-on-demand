"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

type Promo = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minimumOrder: number;
  maximumDiscount?: number | null;
  startDate: string;
  endDate: string;
  status: string;
  usedCount: number;
};

export default function AdminPromosPage() {
  const router = useRouter();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "percentage",
    value: 20,
    minimumOrder: 50000,
    maximumDiscount: 20000,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  });

  async function load() {
    const res = await api<Promo[]>("/api/admin?resource=promos");
    setPromos(res.data || []);
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({ action: "create_promo", ...form }),
    });
    setBusy(false);
    await load();
  }

  async function toggle(p: Promo) {
    await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "update_promo",
        id: p.id,
        status: p.status === "active" ? "inactive" : "active",
      }),
    });
    await load();
  }

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Promos</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form onSubmit={create} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">Buat Promo</h2>
          <input className="input" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed</option>
          </select>
          <input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Min order" value={form.minimumOrder} onChange={(e) => setForm({ ...form, minimumOrder: Number(e.target.value) })} />
          <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : "Simpan"}</button>
        </form>
        <div className="lg:col-span-2 space-y-3">
          {promos.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{p.code} · {p.name}</p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {p.type === "percentage" ? `${p.value}%` : <Money amount={p.value} />} · min{" "}
                  <Money amount={p.minimumOrder} /> · used {p.usedCount} · {p.status}
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {formatDate(p.startDate)} — {formatDate(p.endDate)}
                </p>
              </div>
              <button className="btn btn-secondary text-sm" onClick={() => toggle(p)}>
                {p.status === "active" ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
