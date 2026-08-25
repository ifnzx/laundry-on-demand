"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Phone, User, Trash2, Check } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { EmptyState, LoadingBlock, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  notes?: string | null;
  isDefault: boolean;
};

const emptyForm = {
  label: "Rumah",
  recipientName: "",
  phone: "",
  address: "",
  latitude: -3.1634,
  longitude: 115.0835,
  notes: "",
  isDefault: false,
};

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [gpsMsg, setGpsMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await api<Address[]>("/api/addresses");
    setAddresses(res.data || []);
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
  }, [router]);

  function useGps() {
    setGpsMsg("Mengambil lokasi...");
    if (!navigator.geolocation) {
      setGpsMsg("GPS tidak didukung.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setGpsMsg("Lokasi GPS tersimpan.");
      },
      () => {
        setGpsMsg(
          "Lokasi tidak ditemukan. Pastikan GPS aktif dan izin lokasi diberikan."
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await api("/api/addresses", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setShowForm(false);
    setForm(emptyForm);
    setGpsMsg("");
    await load();
  }

  async function setDefault(id: string) {
    setBusyId(id);
    await api("/api/addresses", {
      method: "PUT",
      body: JSON.stringify({ id, isDefault: true }),
    });
    setBusyId(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus alamat ini?")) return;
    setBusyId(id);
    await api(`/api/addresses?id=${id}`, { method: "DELETE" });
    setBusyId(null);
    await load();
  }

  return (
    <CustomerShell hideNav>
      <div className="px-4 pb-12 pt-6">
        <Link
          href="/profile"
          className="text-sm font-medium text-primary"
        >
          ← Profil
        </Link>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">
              Alamat
            </h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Untuk jemput & antar laundry
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Batal" : "Tambah"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={save}
            className="mt-5 space-y-3 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4"
          >
            <div>
              <label className="label">Label</label>
              <input
                className="input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Rumah, Kantor, ..."
                required
              />
            </div>
            <div>
              <label className="label">Nama penerima</label>
              <input
                className="input"
                value={form.recipientName}
                onChange={(e) =>
                  setForm({ ...form, recipientName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label">Telepon</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Alamat lengkap</label>
              <textarea
                className="input min-h-[88px] resize-none"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Catatan (opsional)</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Patokan, lantai, ..."
              />
            </div>

            <div className="space-y-2 rounded-xl bg-surface-container px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-on-surface">
                    Titik peta
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Ketuk peta / seret pin · untuk hitung ongkir
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-primary"
                  onClick={useGps}
                >
                  Ambil GPS
                </button>
              </div>
              {gpsMsg && (
                <p className="text-xs text-on-surface-variant">{gpsMsg}</p>
              )}
              <LeafletMapClient
                position={{ lat: form.latitude, lng: form.longitude }}
                height={220}
                interactive
                draggableMarker
                onPositionChange={(pos) =>
                  setForm((f) => ({
                    ...f,
                    latitude: pos.lat,
                    longitude: pos.lng,
                  }))
                }
              />
              <p className="font-mono text-[11px] tabular-nums text-on-surface-variant">
                {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                className="rounded border-outline-variant"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.target.checked })
                }
              />
              Jadikan alamat utama
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={saving}
            >
              {saving ? <Spinner /> : "Simpan alamat"}
            </button>
          </form>
        )}

        {loading ? (
          <LoadingBlock />
        ) : addresses.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Belum ada alamat"
              description="Tambahkan alamat untuk jemput dan antar laundry."
            />
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-outline-variant/50 border-y border-outline-variant/50">
            {addresses.map((a) => {
              const mapsUrl = `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=16/${a.latitude}/${a.longitude}`;
              const busy = busyId === a.id;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "py-4",
                    a.isDefault && "bg-primary/[0.03]"
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        a.isDefault
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container text-on-surface-variant"
                      )}
                    >
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-semibold text-on-surface">
                          {a.label}
                        </h2>
                        {a.isDefault && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10">
                            Utama
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm leading-relaxed text-on-surface">
                        {a.address}
                      </p>
                      {a.notes && (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {a.notes}
                        </p>
                      )}

                      <div className="mt-2.5 space-y-1 text-xs text-on-surface-variant">
                        <p className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{a.recipientName}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <a
                            href={`tel:${a.phone}`}
                            className="truncate text-on-surface-variant hover:text-primary"
                          >
                            {a.phone}
                          </a>
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary"
                        >
                          Buka peta
                        </a>
                        {!a.isDefault && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDefault(a.id)}
                            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Jadikan utama
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(a.id)}
                          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-error disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CustomerShell>
  );
}
