import { prisma } from "./db";
import { calculateDeliveryFee, calculateDistanceKm } from "./distance";

export type PricingInput = {
  serviceId: string;
  addressId: string;
  /** Legacy optional; weight is determined at outlet for per_kg services */
  estimatedWeight?: number;
  /** Item quantity for per_item (special laundry) */
  itemQty?: number;
  outletId?: string;
  promoCode?: string;
};

export type PricingResult = {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  pricingType: string;
  estimatedWeight: number;
  estimatedLaundryPrice: number;
  laundryPriceDeferred: boolean;
  outletId: string;
  outletName: string;
  distanceKm: number;
  baseFee: number;
  pricePerKm: number;
  deliveryFee: number;
  discount: number;
  promoCode?: string;
  subtotal: number;
  total: number;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
};

export async function getSettings() {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return {
    baseFee: parseFloat(map.base_fee || "5000"),
    pricePerKm: parseFloat(map.price_per_km || "2000"),
    maximumDistance: parseFloat(map.maximum_distance || "10"),
  };
}

/**
 * Server-side price calculation. Never trust frontend totals.
 * For per_kg services, laundry + ongkir are paid together after weighing
 * (chargeable total at checkout is 0). Fixed-price services pay laundry + ongkir up front.
 */
export async function calculateOrderPricing(
  input: PricingInput
): Promise<{ ok: true; data: PricingResult } | { ok: false; error: string }> {
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
  });
  if (!service || service.status !== "active") {
    return { ok: false, error: "Layanan tidak tersedia" };
  }

  const address = await prisma.address.findUnique({
    where: { id: input.addressId },
  });
  if (!address) {
    return { ok: false, error: "Alamat tidak valid" };
  }

  let outlet;
  if (input.outletId) {
    outlet = await prisma.outlet.findUnique({ where: { id: input.outletId } });
  } else {
    outlet = await prisma.outlet.findFirst({ where: { status: "active" } });
  }
  if (!outlet || outlet.status !== "active") {
    return { ok: false, error: "Outlet tidak tersedia" };
  }

  const distanceKm = calculateDistanceKm(
    address.latitude,
    address.longitude,
    outlet.latitude,
    outlet.longitude
  );

  const settings = await getSettings();
  const maxDistance = Math.min(outlet.serviceRadiusKm, settings.maximumDistance);

  if (distanceKm > maxDistance) {
    return {
      ok: false,
      error: "Maaf, lokasi Anda berada di luar area layanan kami.",
    };
  }

  const pricingType = service.pricingType || "per_kg";
  let estimatedLaundryPrice = 0;
  let laundryPriceDeferred = false;
  // Weight is set at outlet after pickup — not estimated by customer (per_kg).
  // For per_item, this field stores item quantity.
  let estimatedWeight = 0;

  if (pricingType === "fixed") {
    estimatedLaundryPrice = Math.round(service.price);
  } else if (pricingType === "per_item") {
    const rawQty = input.itemQty ?? input.estimatedWeight ?? 1;
    const qty = Math.max(1, Math.min(50, Math.round(Number(rawQty) || 1)));
    estimatedWeight = qty;
    estimatedLaundryPrice = Math.round(service.price * qty);
    laundryPriceDeferred = false;
  } else {
    // per_kg (and other weight-based): price after weighing
    estimatedLaundryPrice = 0;
    laundryPriceDeferred = true;
  }

  const deliveryFee = calculateDeliveryFee(
    distanceKm,
    settings.baseFee,
    settings.pricePerKm
  );

  let discount = 0;
  let appliedPromoCode: string | undefined;

  if (input.promoCode) {
    const promo = await prisma.promo.findUnique({
      where: { code: input.promoCode.toUpperCase() },
    });
    const now = new Date();
    if (
      promo &&
      promo.status === "active" &&
      promo.startDate <= now &&
      promo.endDate >= now &&
      (!promo.usageLimit || promo.usedCount < promo.usageLimit)
    ) {
      // For deferred laundry, lock code now and compute discount after weigh-in
      if (laundryPriceDeferred) {
        appliedPromoCode = promo.code;
      } else {
        const laundrySub = estimatedLaundryPrice + deliveryFee;
        if (laundrySub >= promo.minimumOrder) {
          if (promo.type === "percentage") {
            discount = Math.round((laundrySub * promo.value) / 100);
            if (promo.maximumDiscount) {
              discount = Math.min(discount, promo.maximumDiscount);
            }
          } else {
            discount = promo.value;
          }
          appliedPromoCode = promo.code;
        }
      }
    }
  }

  const subtotal = estimatedLaundryPrice + deliveryFee;
  // Per-kg: charge nothing at booking — laundry + ongkir invoiced after weigh-in
  const total = laundryPriceDeferred
    ? 0
    : Math.max(0, subtotal - discount);

  return {
    ok: true,
    data: {
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      pricingType,
      estimatedWeight,
      estimatedLaundryPrice,
      laundryPriceDeferred,
      outletId: outlet.id,
      outletName: outlet.name,
      distanceKm,
      baseFee: settings.baseFee,
      pricePerKm: settings.pricePerKm,
      deliveryFee,
      discount: laundryPriceDeferred ? 0 : discount,
      promoCode: appliedPromoCode,
      // Show ongkir estimate on checkout; total to pay is still 0 when deferred
      subtotal: laundryPriceDeferred ? deliveryFee : subtotal,
      total,
      latitude: address.latitude,
      longitude: address.longitude,
      serviceRadiusKm: maxDistance,
    },
  };
}

export async function calculateActualPrice(
  orderId: string,
  actualWeight: number
): Promise<
  | {
      ok: true;
      data: {
        actualWeight: number;
        actualLaundryPrice: number;
        actualSubtotal: number;
        actualTotal: number;
        discount: number;
        additionalPayment: number;
      };
    }
  | { ok: false; error: string }
> {
  if (actualWeight <= 0) {
    return { ok: false, error: "Berat aktual harus lebih dari 0" };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order tidak ditemukan" };

  const actualLaundryPrice = Math.round(actualWeight * order.pricePerKg);
  const actualSubtotal = actualLaundryPrice + order.deliveryFee;

  // Re-apply promo on final laundry + ongkir (both charged together after weigh)
  let discount = order.discount;
  if (order.promoCode) {
    const promo = await prisma.promo.findUnique({
      where: { code: order.promoCode },
    });
    const now = new Date();
    if (
      promo &&
      promo.status === "active" &&
      promo.startDate <= now &&
      promo.endDate >= now &&
      actualSubtotal >= promo.minimumOrder
    ) {
      if (promo.type === "percentage") {
        discount = Math.round((actualSubtotal * promo.value) / 100);
        if (promo.maximumDiscount) {
          discount = Math.min(discount, promo.maximumDiscount);
        }
      } else {
        discount = promo.value;
      }
    }
  }

  const actualTotal = Math.max(0, actualSubtotal - discount);
  const additionalPayment = Math.max(0, actualTotal - order.paidAmount);

  return {
    ok: true,
    data: {
      actualWeight,
      actualLaundryPrice,
      actualSubtotal,
      actualTotal,
      discount,
      additionalPayment,
    },
  };
}

export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const prefix = `ORD-${yyyy}${mm}${dd}-`;

  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
  });

  let seq = 1;
  if (last) {
    const parts = last.orderNumber.split("-");
    seq = parseInt(parts[2] || "0", 10) + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}
