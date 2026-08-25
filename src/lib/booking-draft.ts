export type BookingDraft = {
  serviceId: string;
  serviceName?: string;
  servicePrice?: number;
  pricingType?: string;
  /** Jumlah item untuk layanan per_item (laundry khusus) */
  itemQty?: number;
  addressId: string;
  pickupType: "pickup_now" | "scheduled";
  pickupDate?: string;
  pickupTimeStart?: string;
  pickupTimeEnd?: string;
  promoCode?: string;
  notes?: string;
};

const KEY = "lod_booking_draft";

export function getBookingDraft(): Partial<BookingDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setBookingDraft(patch: Partial<BookingDraft>) {
  if (typeof window === "undefined") return;
  const current = getBookingDraft();
  sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearBookingDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export const TIME_SLOTS = [
  { start: "09:00", end: "10:00", label: "09:00 - 10:00" },
  { start: "10:00", end: "11:00", label: "10:00 - 11:00" },
  { start: "11:00", end: "12:00", label: "11:00 - 12:00" },
  { start: "13:00", end: "14:00", label: "13:00 - 14:00" },
  { start: "14:00", end: "15:00", label: "14:00 - 15:00" },
  { start: "15:00", end: "16:00", label: "15:00 - 16:00" },
];

export function serviceVisual(name: string) {
  const n = name.toLowerCase();
  if (n.includes("express")) {
    return {
      icon: "bolt",
      accent: "primary",
      express: true,
      blurb: "Selesai dalam 6 jam",
    };
  }
  if (n.includes("sepatu")) {
    return {
      icon: "footprint",
      accent: "primary",
      express: false,
      blurb: "Deep clean & kering",
    };
  }
  if (n.includes("tas")) {
    return {
      icon: "shopping_bag",
      accent: "secondary",
      express: false,
      blurb: "Cuci luar & dalam",
    };
  }
  if (n.includes("selimut")) {
    return {
      icon: "bed",
      accent: "tertiary",
      express: false,
      blurb: "Cuci & kering sempurna",
    };
  }
  if (n.includes("boneka")) {
    return {
      icon: "child_care",
      accent: "primary",
      express: false,
      blurb: "Cuci lembut & higienis",
    };
  }
  if (n.includes("cuci") && n.includes("setrika")) {
    return {
      icon: "local_laundry_service",
      accent: "primary",
      express: false,
      blurb: "Bersih, kering & rapi",
    };
  }
  if (n.includes("cuci")) {
    return {
      icon: "water_drop",
      accent: "secondary",
      express: false,
      blurb: "Bersih & kering",
    };
  }
  if (n.includes("setrika")) {
    return {
      icon: "iron",
      accent: "tertiary",
      express: false,
      blurb: "Rapi & wangi",
    };
  }
  return {
    icon: "checkroom",
    accent: "primary",
    express: false,
    blurb: "Layanan laundry",
  };
}

/** Layanan laundry khusus (per item / sepatu tas selimut boneka) */
export function isSpecialLaundryService(s: {
  name?: string | null;
  pricingType?: string | null;
}) {
  if (s.pricingType === "per_item") return true;
  return /sepatu|tas\b|selimut|boneka|khusus/i.test(s.name || "");
}
