"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatRupiah } from "@/lib/utils";

export default function AdminPricingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    base_fee: 5000,
    price_per_km: 2000,
    maximum_distance: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      const res = await api<{
        baseFee: number;
        pricePerKm: number;
        maximumDistance: number;
      }>("/api/admin?resource=settings");
      if (res.data) {
        setForm({
          base_fee: res.data.baseFee,
          price_per_km: res.data.pricePerKm,
          maximum_distance: res.data.maximumDistance,
        });
      }
      setLoading(false);
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({ action: "update_settings", ...form }),
    });
    setSaving(false);
    setMsg(res.success ? "Pengaturan disimpan" : res.error || "Gagal");
  }

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  const example = form.base_fee + 5 * form.price_per_km;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Pricing</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Ongkir = base fee + (jarak × harga per km)
      </p>

      <form onSubmit={save} className="card mt-6 max-w-lg space-y-4 p-6">
        <div>
          <label className="label">Base Fee (Rp)</label>
          <input
            className="input"
            type="number"
            value={form.base_fee}
            onChange={(e) => setForm({ ...form, base_fee: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Price / KM (Rp)</label>
          <input
            className="input"
            type="number"
            value={form.price_per_km}
            onChange={(e) =>
              setForm({ ...form, price_per_km: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="label">Maximum Distance (KM)</label>
          <input
            className="input"
            type="number"
            value={form.maximum_distance}
            onChange={(e) =>
              setForm({ ...form, maximum_distance: Number(e.target.value) })
            }
          />
        </div>

        <div className="rounded-xl bg-[var(--brand-soft)] p-4 text-sm">
          Contoh 5 KM: {formatRupiah(form.base_fee)} + (5 × {formatRupiah(form.price_per_km)}) ={" "}
          <strong>{formatRupiah(example)}</strong>
        </div>

        {msg && <p className="text-sm text-[var(--brand)]">{msg}</p>}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner /> : "Simpan Pricing"}
        </button>
      </form>
    </AdminShell>
  );
}
