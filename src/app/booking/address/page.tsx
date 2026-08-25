"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui";
import { LeafletMapClient } from "@/components/maps/leaflet-map-client";
import { api } from "@/lib/client-api";
import {
  getBookingDraft,
  setBookingDraft,
  TIME_SLOTS,
} from "@/lib/booking-draft";
import { cn } from "@/lib/utils";

type Address = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

export default function AddressSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [pickupType, setPickupType] = useState<"pickup_now" | "scheduled">(
    "pickup_now"
  );
  const [slot, setSlot] = useState(TIME_SLOTS[1].label);
  const [gpsMsg, setGpsMsg] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      const draft = getBookingDraft();
      if (!draft.serviceId) {
        router.replace("/booking");
        return;
      }

      const res = await api<Address[]>("/api/addresses");
      const list = res.data || [];
      setAddresses(list);
      const def =
        list.find((a) => a.id === draft.addressId) ||
        list.find((a) => a.isDefault) ||
        list[0];
      if (def) {
        setAddressId(def.id);
        setCoords({ lat: def.latitude, lng: def.longitude });
      }
      if (draft.pickupType) setPickupType(draft.pickupType);
      if (draft.pickupTimeStart && draft.pickupTimeEnd) {
        setSlot(`${draft.pickupTimeStart} - ${draft.pickupTimeEnd}`);
      }
      setLoading(false);
    })();
  }, [router]);

  const selected = addresses.find((a) => a.id === addressId);

  function useMyLocation() {
    setGpsMsg("Mengambil lokasi...");
    if (!navigator.geolocation) {
      setGpsMsg("GPS tidak didukung di perangkat ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsMsg("Lokasi GPS berhasil diambil.");
      },
      () => {
        setGpsMsg(
          "Lokasi tidak ditemukan. Pastikan GPS aktif dan izin lokasi diberikan."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectAddress(a: Address) {
    setAddressId(a.id);
    setCoords({ lat: a.latitude, lng: a.longitude });
  }

  function confirm() {
    if (!addressId) return;
    const [start, end] = slot.split(" - ");
    const today = new Date();
    const pickupDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    setBookingDraft({
      addressId,
      pickupType,
      pickupDate: pickupType === "scheduled" ? pickupDate : undefined,
      pickupTimeStart: pickupType === "scheduled" ? start : undefined,
      pickupTimeEnd: pickupType === "scheduled" ? end : undefined,
    });
    router.push("/checkout");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <LoadingBlock />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface text-on-surface">
      <div className="relative w-full max-w-md overflow-hidden bg-surface pb-24 shadow-sm md:my-8 md:min-h-[800px] md:rounded-2xl md:shadow-lg">
        <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-outline-variant/40 bg-surface px-4">
          <button
            type="button"
            onClick={() => router.push("/booking")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant/50"
            aria-label="Kembali"
          >
            <span className="material-symbols-outlined text-[22px]">
              arrow_back
            </span>
          </button>
          <h1 className="text-base font-semibold text-on-surface">
            Alamat & jadwal
          </h1>
          <div className="w-9" />
        </header>

        <main className="flex flex-col gap-4 p-4">
          {/* Map (Leaflet) */}
          <section>
            <div className="relative overflow-hidden rounded-xl">
              <LeafletMapClient
                position={coords}
                height={180}
                zoom={15}
                interactive={false}
              />
              <button
                type="button"
                onClick={useMyLocation}
                className="absolute bottom-2.5 right-2.5 z-[1000] flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface/95 px-2.5 py-1.5 text-xs font-medium text-primary shadow-md backdrop-blur-md transition-colors hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined text-[16px]">
                  my_location
                </span>
                Lokasi saya
              </button>
            </div>
            {gpsMsg && (
              <p className="mt-1.5 text-[11px] text-on-surface-variant">
                {gpsMsg}
              </p>
            )}
          </section>

          {/* Address */}
          {selected ? (
            <section>
              <div className="relative overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                      <span className="material-symbols-outlined fill text-[18px] text-primary">
                        home
                      </span>
                      {selected.label}
                    </h2>
                    <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                      {selected.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/profile/addresses")}
                    className="shrink-0 whitespace-nowrap rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-[11px] font-medium text-secondary hover:underline"
                  >
                    Ubah
                  </button>
                </div>
              </div>

              {addresses.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectAddress(a)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        a.id === addressId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant/50 text-on-surface-variant"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-center">
              <p className="text-sm text-on-surface-variant">Belum ada alamat</p>
              <button
                type="button"
                onClick={() => router.push("/profile/addresses")}
                className="mt-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-on-primary"
              >
                Tambah alamat
              </button>
            </section>
          )}

          <hr className="border-outline-variant/30" />

          {/* Schedule */}
          <section className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-on-surface">
              Jadwal pickup
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPickupType("pickup_now")}
                className={cn(
                  "relative flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                  pickupType === "pickup_now"
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/50 hover:bg-surface-variant/30"
                )}
              >
                <span className="material-symbols-outlined text-[22px] text-primary">
                  flash_on
                </span>
                <span className="text-xs font-medium text-on-surface">
                  Sekarang
                </span>
                {pickupType === "pickup_now" && (
                  <span className="material-symbols-outlined fill absolute right-1.5 top-1.5 text-[16px] text-primary">
                    check_circle
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPickupType("scheduled")}
                className={cn(
                  "relative flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                  pickupType === "scheduled"
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/50 hover:bg-surface-variant/30"
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[22px]",
                    pickupType === "scheduled"
                      ? "text-primary"
                      : "text-on-surface-variant"
                  )}
                >
                  calendar_month
                </span>
                <span className="text-xs font-medium text-on-surface">
                  Jadwalkan
                </span>
                {pickupType === "scheduled" && (
                  <span className="material-symbols-outlined fill absolute right-1.5 top-1.5 text-[16px] text-primary">
                    check_circle
                  </span>
                )}
              </button>
            </div>

            {pickupType === "scheduled" && (
              <div className="mt-1 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-on-surface-variant">
                  Waktu hari ini
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setSlot(t.label)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        slot === t.label
                          ? "border border-primary bg-primary text-on-primary shadow-sm"
                          : "border border-outline-variant/50 text-on-surface hover:bg-surface-variant"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>

        <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant/20 bg-surface p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:absolute md:max-w-md">
          <button
            type="button"
            onClick={confirm}
            disabled={!addressId}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-semibold text-on-primary-container shadow-sm transition-colors hover:bg-primary active:scale-[0.98] disabled:opacity-50"
          >
            Lanjut ke checkout
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
