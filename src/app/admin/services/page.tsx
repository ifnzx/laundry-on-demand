"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatRupiah } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  pricingType: string;
  estimatedDuration: number;
  status: string;
};

const PRICING_OPTIONS = [
  { value: "per_kg", label: "Per kg", unit: "/ kg" },
  { value: "per_item", label: "Per item", unit: "/ item" },
  { value: "fixed", label: "Harga tetap", unit: " (paket)" },
] as const;

function pricingLabel(type: string) {
  return PRICING_OPTIONS.find((p) => p.value === type)?.label || type;
}

function pricingUnit(type: string) {
  return PRICING_OPTIONS.find((p) => p.value === type)?.unit || "";
}

const emptyForm = {
  name: "",
  description: "",
  price: 8000,
  pricingType: "per_kg",
  estimatedDuration: 48,
};

export default function AdminServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const res = await api<Service[]>("/api/services");
    const list = res.data || [];
    setServices(list);
    const drafts: Record<string, string> = {};
    for (const s of list) drafts[s.id] = String(s.price);
    setPriceDraft(drafts);
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
    setError("");
    if (!form.name.trim()) {
      setError("Nama layanan wajib diisi");
      return;
    }
    if (!Number.isFinite(form.price) || form.price <= 0) {
      setError("Harga harus lebih dari 0");
      return;
    }
    setBusy(true);
    const res = await api("/api/services", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: form.price,
        pricingType: form.pricingType,
        estimatedDuration: form.estimatedDuration,
      }),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setForm(emptyForm);
    await load();
  }

  async function toggle(s: Service) {
    setSavingId(s.id);
    await api("/api/services", {
      method: "PUT",
      body: JSON.stringify({
        id: s.id,
        status: s.status === "active" ? "inactive" : "active",
      }),
    });
    setSavingId(null);
    await load();
  }

  async function savePrice(s: Service) {
    const v = Number(priceDraft[s.id]);
    if (!Number.isFinite(v) || v <= 0) {
      setPriceDraft((d) => ({ ...d, [s.id]: String(s.price) }));
      return;
    }
    if (v === s.price) return;
    setSavingId(s.id);
    await api("/api/services", {
      method: "PUT",
      body: JSON.stringify({ id: s.id, price: v }),
    });
    setSavingId(null);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Layanan</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Katalog harga cuci untuk pelanggan
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
        {/* Form */}
        <form
          onSubmit={create}
          className="card h-fit space-y-4 p-5 xl:sticky xl:top-24"
        >
          <h2 className="font-semibold">Tambah layanan</h2>

          <div>
            <label className="label" htmlFor="svc-name">
              Nama
            </label>
            <input
              id="svc-name"
              className="input"
              placeholder="Contoh: Cuci + Setrika"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="svc-desc">
              Deskripsi
            </label>
            <textarea
              id="svc-desc"
              className="input min-h-[72px] resize-y"
              placeholder="Singkat dan jelas (opsional)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="svc-price">
                Harga (Rp)
              </label>
              <input
                id="svc-price"
                className="input"
                type="number"
                min={1}
                step={500}
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="svc-type">
                Satuan
              </label>
              <select
                id="svc-type"
                className="input"
                value={form.pricingType}
                onChange={(e) =>
                  setForm({ ...form, pricingType: e.target.value })
                }
              >
                {PRICING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="svc-dur">
              Estimasi selesai (jam)
            </label>
            <input
              id="svc-dur"
              className="input"
              type="number"
              min={1}
              value={form.estimatedDuration}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimatedDuration: Number(e.target.value),
                })
              }
              required
            />
          </div>

          <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-xs text-[var(--fg)]">
            Pratinjau:{" "}
            <strong>
              {formatRupiah(form.price || 0)}
              {pricingUnit(form.pricingType)}
            </strong>
            {" · "}~{form.estimatedDuration || 0} jam
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : "Simpan layanan"}
          </button>
        </form>

        {/* List — table for precision */}
        <div className="card overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">
              Daftar layanan{" "}
              <span className="font-normal text-[var(--fg-muted)]">
                ({services.length})
              </span>
            </p>
          </div>

          {services.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
              Belum ada layanan. Tambah dari formulir di kiri.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[#f8fafb] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                    <th className="px-4 py-3 font-semibold">Layanan</th>
                    <th className="w-36 px-3 py-3 font-semibold">Harga</th>
                    <th className="w-28 px-3 py-3 font-semibold">Satuan</th>
                    <th className="w-24 px-3 py-3 font-semibold">Estimasi</th>
                    <th className="w-24 px-3 py-3 font-semibold">Status</th>
                    <th className="w-32 px-3 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-[var(--fg)]">
                          {s.name}
                        </p>
                        {s.description ? (
                          <p className="mt-0.5 max-w-xs text-xs leading-snug text-[var(--fg-muted)]">
                            {s.description}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                            —
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <input
                            className="input !py-2 text-right font-medium tabular-nums"
                            type="number"
                            min={1}
                            step={500}
                            value={priceDraft[s.id] ?? s.price}
                            onChange={(e) =>
                              setPriceDraft((d) => ({
                                ...d,
                                [s.id]: e.target.value,
                              }))
                            }
                            onBlur={() => savePrice(s)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            disabled={savingId === s.id}
                            aria-label={`Harga ${s.name}`}
                          />
                          <span className="text-[11px] text-[var(--fg-muted)]">
                            {formatRupiah(
                              Number(priceDraft[s.id] ?? s.price) || 0
                            )}
                            {pricingUnit(s.pricingType)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[var(--fg-muted)]">
                        {pricingLabel(s.pricingType)}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-[var(--fg-muted)]">
                        {s.estimatedDuration} jam
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={
                            s.status === "active"
                              ? "badge bg-emerald-100 text-emerald-800"
                              : "badge bg-gray-100 text-gray-600"
                          }
                        >
                          {s.status === "active" ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          className="btn btn-secondary !px-3 !py-1.5 text-xs"
                          disabled={savingId === s.id}
                          onClick={() => toggle(s)}
                        >
                          {savingId === s.id ? (
                            <Spinner />
                          ) : s.status === "active" ? (
                            "Nonaktifkan"
                          ) : (
                            "Aktifkan"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--fg-muted)]">
            Ubah harga lalu tekan Enter atau klik di luar kolom untuk menyimpan.
            Contoh: {formatRupiah(8000)}
            {pricingUnit("per_kg")}.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
