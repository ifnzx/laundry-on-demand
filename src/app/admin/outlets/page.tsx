"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { LoadingBlock, Spinner } from "@/components/ui";
import { osmMapUrl } from "@/lib/maps";
import { api } from "@/lib/client-api";

type Outlet = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  serviceRadiusKm: number;
  status: string;
};

const emptyForm = {
  name: "",
  address: "",
  latitude: null as number | null,
  longitude: null as number | null,
  phone: "",
  serviceRadiusKm: 10,
};

export default function AdminOutletsPage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await api<Outlet[]>("/api/admin?resource=outlets");
    setOutlets(res.data || []);
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

  async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string };
      return data.display_name || null;
    } catch {
      return null;
    }
  }

  function useGps() {
    setGpsMsg("");
    setError("");
    if (!navigator.geolocation) {
      setGpsMsg("GPS tidak didukung di perangkat ini.");
      return;
    }
    setGpsBusy(true);
    setGpsMsg("Mengambil lokasi GPS...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setForm((f) => ({ ...f, latitude, longitude }));
        setGpsMsg("Lokasi GPS berhasil diambil. Mencari alamat...");

        const named = await reverseGeocode(latitude, longitude);
        if (named) {
          setForm((f) => ({
            ...f,
            latitude,
            longitude,
            address: f.address.trim() ? f.address : named,
          }));
          setGpsMsg("Lokasi GPS & alamat tersimpan. Anda bisa edit alamat teks jika perlu.");
        } else {
          setGpsMsg(
            "Lokasi GPS tersimpan. Isi alamat teks manual (reverse geocode gagal)."
          );
        }
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsMsg(
            "Izin lokasi ditolak. Izinkan akses lokasi di browser, lalu coba lagi."
          );
        } else if (err.code === err.TIMEOUT) {
          setGpsMsg("Timeout GPS. Pastikan GPS aktif dan coba lagi di luar ruangan.");
        } else {
          setGpsMsg(
            "Lokasi tidak ditemukan. Pastikan GPS aktif dan izin lokasi diberikan."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.latitude == null || form.longitude == null) {
      setError("Ambil lokasi GPS dulu sebelum menyimpan outlet.");
      return;
    }
    setBusy(true);
    const res = await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "create_outlet",
        name: form.name,
        address: form.address,
        phone: form.phone,
        latitude: form.latitude,
        longitude: form.longitude,
        serviceRadiusKm: form.serviceRadiusKm,
      }),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error || "Gagal menyimpan outlet");
      return;
    }
    setForm(emptyForm);
    setGpsMsg("");
    await load();
  }

  async function toggle(o: Outlet) {
    await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "update_outlet",
        id: o.id,
        status: o.status === "active" ? "inactive" : "active",
      }),
    });
    await load();
  }

  function mapsUrl(lat: number, lng: number) {
    return osmMapUrl(lat, lng);
  }

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  const hasGps = form.latitude != null && form.longitude != null;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Outlet</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Lokasi di peta Leaflet (OSM) — GPS, ketuk, atau seret pin
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form onSubmit={create} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">Tambah Outlet</h2>
          <div>
            <label className="label">Nama outlet</label>
            <input
              className="input"
              placeholder="Contoh: Laundry Binuang"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Telepon</label>
            <input
              className="input"
              placeholder="08xxxxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Alamat teks</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Akan diisi otomatis dari GPS (bisa diedit)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </div>

          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-container-low)] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              Lokasi (Leaflet)
            </p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Ambil GPS, ketuk peta, atau seret pin. Lingkaran = radius layanan.
            </p>
            <div className="mt-2">
              <LeafletMapClient
                position={
                  hasGps
                    ? { lat: form.latitude!, lng: form.longitude! }
                    : null
                }
                height={220}
                interactive
                draggableMarker
                radiusKm={form.serviceRadiusKm}
                onPositionChange={(pos) =>
                  setForm((f) => ({
                    ...f,
                    latitude: pos.lat,
                    longitude: pos.lng,
                  }))
                }
              />
            </div>
            {hasGps && (
              <p className="mt-2 font-mono text-xs tabular-nums">
                {form.latitude!.toFixed(6)}, {form.longitude!.toFixed(6)}
              </p>
            )}
            <button
              type="button"
              className="btn btn-secondary mt-3 w-full"
              onClick={useGps}
              disabled={gpsBusy}
            >
              {gpsBusy ? (
                <>
                  <Spinner /> Mengambil GPS...
                </>
              ) : hasGps ? (
                "Ambil ulang dari GPS"
              ) : (
                "Ambil dari GPS"
              )}
            </button>
            {gpsMsg && (
              <p className="mt-2 text-xs text-[var(--fg-muted)]">{gpsMsg}</p>
            )}
          </div>

          <div>
            <label className="label">Radius layanan (km)</label>
            <input
              className="input"
              type="number"
              min={1}
              step={0.5}
              value={form.serviceRadiusKm}
              onChange={(e) =>
                setForm({ ...form, serviceRadiusKm: Number(e.target.value) })
              }
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || !hasGps}
          >
            {busy ? <Spinner /> : "Simpan outlet"}
          </button>
        </form>

        <div className="space-y-3 lg:col-span-2">
          {outlets.length === 0 && (
            <p className="text-sm text-[var(--fg-muted)]">Belum ada outlet.</p>
          )}
          {outlets.map((o) => (
            <div
              key={o.id}
              className="card flex flex-wrap items-start justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {o.name}{" "}
                  <span className="text-xs font-normal text-[var(--fg-muted)]">
                    · {o.status}
                  </span>
                </p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{o.address}</p>
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  Radius {o.serviceRadiusKm} km · {o.phone}
                </p>
                <div className="mt-2 overflow-hidden rounded-lg">
                  <LeafletMapClient
                    position={{ lat: o.latitude, lng: o.longitude }}
                    height={140}
                    zoom={14}
                    showCoords={false}
                    radiusKm={o.serviceRadiusKm}
                  />
                </div>
                <a
                  href={mapsUrl(o.latitude, o.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-[var(--brand)]"
                >
                  Buka OpenStreetMap
                </a>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => toggle(o)}
              >
                {o.status === "active" ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
