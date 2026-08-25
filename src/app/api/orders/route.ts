import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
  jsonValidation,
} from "@/lib/api";
import {
  calculateOrderPricing,
  generateOrderNumber,
} from "@/lib/pricing";
import {
  createNotification,
  recordStatusHistory,
} from "@/lib/notifications";
import { updateOrderStatus } from "@/lib/order-service";
import { calculateActualPrice } from "@/lib/pricing";
import { assertBillingAllowed } from "@/lib/platform-billing";

const createOrderSchema = z.object({
  serviceId: z.string().min(1),
  addressId: z.string().min(1),
  pickupType: z.enum(["pickup_now", "scheduled"]),
  pickupDate: z.string().optional(),
  pickupTimeStart: z.string().optional(),
  pickupTimeEnd: z.string().optional(),
  promoCode: z.string().optional(),
  notes: z.string().optional(),
  itemQty: z.number().int().min(1).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const status = searchParams.get("status");
  const filter = searchParams.get("filter"); // active | completed | cancelled

  if (id) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        service: true,
        address: true,
        outlet: true,
        customer: {
          select: { id: true, name: true, phone: true, photo: true },
        },
        courier: {
          select: { id: true, name: true, phone: true, photo: true, vehicle: true, rating: true },
        },
        payments: { orderBy: { createdAt: "desc" } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        deliveryProof: true,
        rating: true,
      },
    });
    if (!order) return jsonError("Order tidak ditemukan", 404);

    if (session.role === "customer" && order.customerId !== session.id) {
      return jsonForbidden();
    }
    if (session.role === "courier" && order.courierId !== session.id) {
      return jsonForbidden();
    }
    return jsonOk(order);
  }

  // List
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (session.role === "customer") {
    where.customerId = session.id;
  } else if (session.role === "courier") {
    where.courierId = session.id;
  }

  if (status) where.orderStatus = status;

  if (filter === "active") {
    // Semua order yang masih berjalan (termasuk menunggu bayar)
    where.orderStatus = {
      notIn: ["completed", "cancelled"],
    };
  } else if (filter === "completed") {
    where.orderStatus = "completed";
  } else if (filter === "cancelled") {
    where.orderStatus = "cancelled";
  } else if (filter === "pending_payment") {
    where.orderStatus = "pending_payment";
  }

  // Admin filters
  if (session.role === "admin") {
    const serviceId = searchParams.get("serviceId");
    const courierId = searchParams.get("courierId");
    const paymentStatus = searchParams.get("paymentStatus");
    if (serviceId) where.serviceId = serviceId;
    if (courierId) where.courierId = courierId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (searchParams.get("q")) {
      const q = searchParams.get("q")!;
      where.OR = [
        { orderNumber: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { phone: { contains: q } } },
      ];
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      service: true,
      address: true,
      outlet: true,
      customer: { select: { id: true, name: true, phone: true } },
      courier: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Admin: flag unread customer chat messages on each order
  if (session.role === "admin" && orders.length > 0) {
    const unreadRows = await prisma.orderMessage.groupBy({
      by: ["orderId"],
      where: {
        orderId: { in: orders.map((o) => o.id) },
        isRead: false,
        sender: { role: "customer" },
      },
      _count: { id: true },
    });
    const unreadByOrder = new Map(
      unreadRows.map((r) => [r.orderId, r._count.id] as const)
    );
    return jsonOk(
      orders.map((o) => ({
        ...o,
        unreadMessages: unreadByOrder.get(o.id) ?? 0,
      }))
    );
  }

  return jsonOk(orders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const billing = await assertBillingAllowed();
  if (!billing.ok) return jsonError(billing.error, 423);

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation("Data tidak valid", parsed.error.flatten());
    }

    // Verify address ownership
    const address = await prisma.address.findFirst({
      where: { id: parsed.data.addressId, userId: auth.user.id },
    });
    if (!address) return jsonError("Alamat tidak valid", 404);

    if (parsed.data.pickupType === "scheduled") {
      if (!parsed.data.pickupDate || !parsed.data.pickupTimeStart) {
        return jsonValidation("Jadwal pickup wajib diisi");
      }
    }

    // Backend recalculates ALL prices (laundry for per_kg deferred until weigh-in)
    const pricing = await calculateOrderPricing({
      serviceId: parsed.data.serviceId,
      addressId: parsed.data.addressId,
      promoCode: parsed.data.promoCode,
      itemQty: parsed.data.itemQty,
    });

    if (!pricing.ok) {
      return jsonError(pricing.error, 422);
    }

    const p = pricing.data;
    const orderNumber = await generateOrderNumber();

    // If nothing due yet (rare: free delivery + deferred laundry), skip payment gate
    const needsPrepay = p.total > 0;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: auth.user.id,
        outletId: p.outletId,
        serviceId: p.serviceId,
        addressId: parsed.data.addressId,
        estimatedWeight: p.estimatedWeight,
        pricePerKg: p.servicePrice,
        estimatedLaundryPrice: p.estimatedLaundryPrice,
        distanceKm: p.distanceKm,
        deliveryFee: p.deliveryFee,
        discount: p.discount,
        subtotal: p.subtotal,
        total: p.total,
        remainingAmount: needsPrepay ? p.total : 0,
        paymentStatus: needsPrepay ? "pending" : "pending",
        orderStatus: needsPrepay ? "pending_payment" : "waiting_courier",
        pickupType: parsed.data.pickupType,
        pickupDate: parsed.data.pickupDate,
        pickupTimeStart: parsed.data.pickupTimeStart,
        pickupTimeEnd: parsed.data.pickupTimeEnd,
        notes: parsed.data.notes,
        promoCode: p.promoCode,
      },
      include: {
        service: true,
        address: true,
        outlet: true,
      },
    });

    await recordStatusHistory({
      orderId: order.id,
      status: order.orderStatus,
      changedBy: auth.user.id,
      note: p.laundryPriceDeferred
        ? "Order dibuat — laundry + ongkir dibayar setelah penimbangan di outlet"
        : p.pricingType === "per_item"
          ? `Order laundry khusus dibuat (${p.estimatedWeight} item)`
          : "Order dibuat",
    });

    await createNotification({
      userId: auth.user.id,
      orderId: order.id,
      title: "Order Berhasil Dibuat",
      message: needsPrepay
        ? `Pesanan ${orderNumber} berhasil dibuat. Silakan selesaikan pembayaran laundry + ongkir.`
        : p.laundryPriceDeferred
          ? `Pesanan ${orderNumber} berhasil dibuat. Laundry dan ongkir dibayar setelah penimbangan di outlet.`
          : `Pesanan ${orderNumber} berhasil dibuat. Menunggu jemput oleh tim outlet.`,
    });

    if (p.promoCode) {
      await prisma.promo.update({
        where: { code: p.promoCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (needsPrepay) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: auth.user.id,
          amount: p.total,
          paymentType: "initial",
          paymentMethod: "qris",
          status: "pending",
          transactionId: `TXN-${orderNumber}`,
        },
      });
    }

    return jsonOk(order, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Gagal membuat order", 500);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const body = await req.json();
  const { action, orderId } = body;

  if (!orderId || !action) return jsonError("orderId dan action wajib");

  // Saat tagihan SaaS menunggak, blok operasi operasional (baca/cancel/rate masih boleh)
  if (!["rate", "cancel"].includes(action)) {
    const billing = await assertBillingAllowed();
    if (!billing.ok) return jsonError(billing.error, 423);
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return jsonError("Order tidak ditemukan", 404);

  // --- STATUS UPDATE ---
  if (action === "update_status") {
    if (session.role !== "admin" && session.role !== "courier") {
      return jsonForbidden();
    }
    if (session.role === "courier" && order.courierId !== session.id) {
      return jsonForbidden();
    }
    const result = await updateOrderStatus({
      orderId,
      newStatus: body.status,
      changedBy: session.id,
      note: body.note,
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  // --- ASSIGN COURIER (opsional, bisa staff/admin) ---
  if (action === "assign_courier") {
    if (session.role !== "admin") return jsonForbidden();
    const courierId = body.courierId || session.id;

    const handler = await prisma.user.findFirst({
      where: {
        id: courierId,
        role: { in: ["courier", "admin"] },
        status: "active",
      },
    });
    if (!handler) return jsonError("Petugas tidak ditemukan", 404);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        courierId: handler.id,
        assignedAt: new Date(),
      },
    });

    if (order.orderStatus === "ready_for_delivery") {
      const result = await updateOrderStatus({
        orderId,
        newStatus: "courier_to_customer_delivery",
        changedBy: session.id,
        note: `Pengantaran ditangani ${handler.name}`,
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    const result = await updateOrderStatus({
      orderId,
      newStatus: "courier_assigned",
      changedBy: session.id,
      note: `Pickup ditangani ${handler.name}`,
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  // --- LOGISTICS (admin = outlet + pickup + delivery) ---
  if (action === "logistics") {
    if (session.role !== "admin") return jsonForbidden();
    const step = body.step as string;

    // Admin becomes order handler
    if (!order.courierId || body.takeOver) {
      await prisma.order.update({
        where: { id: orderId },
        data: { courierId: session.id, assignedAt: new Date() },
      });
    }

    if (step === "start_pickup") {
      if (
        !["waiting_courier", "courier_assigned"].includes(order.orderStatus)
      ) {
        return jsonError("Order tidak dalam antrian jemput", 422);
      }
      const result = await updateOrderStatus({
        orderId,
        newStatus: "courier_to_customer",
        changedBy: session.id,
        note: body.note || "Tim outlet berangkat jemput laundry",
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    if (step === "confirm_pickup") {
      if (
        !["courier_to_customer", "waiting_courier", "courier_assigned"].includes(
          order.orderStatus
        )
      ) {
        return jsonError("Order belum siap dikonfirmasi pickup", 422);
      }
      if (body.pickupPhoto) {
        await prisma.order.update({
          where: { id: orderId },
          data: { pickupPhoto: body.pickupPhoto },
        });
      }
      // Jika masih waiting, loncat status berurutan
      if (order.orderStatus === "waiting_courier") {
        await updateOrderStatus({
          orderId,
          newStatus: "courier_to_customer",
          changedBy: session.id,
          note: "Langsung pickup",
          notifyCustomer: false,
        });
      } else if (order.orderStatus === "courier_assigned") {
        await updateOrderStatus({
          orderId,
          newStatus: "courier_to_customer",
          changedBy: session.id,
          note: "Berangkat jemput",
          notifyCustomer: false,
        });
      }
      const result = await updateOrderStatus({
        orderId,
        newStatus: "picked_up",
        changedBy: session.id,
        note: body.note || "Laundry berhasil diambil",
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    if (step === "receive_outlet") {
      const result = await updateOrderStatus({
        orderId,
        newStatus: "received_at_outlet",
        changedBy: session.id,
        note: body.note || "Laundry diterima di outlet",
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    if (step === "start_delivery") {
      if (order.orderStatus !== "ready_for_delivery") {
        return jsonError("Order belum siap diantar", 422);
      }
      const result = await updateOrderStatus({
        orderId,
        newStatus: "courier_to_customer_delivery",
        changedBy: session.id,
        note: body.note || "Tim outlet berangkat antar laundry",
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    if (step === "confirm_delivery") {
      const recipientName = body.recipientName || order.customerId;
      if (!body.recipientName) {
        // Allow using address recipient as fallback
      }
      const name =
        body.recipientName ||
        (
          await prisma.address.findUnique({ where: { id: order.addressId } })
        )?.recipientName ||
        "Customer";

      if (
        !["courier_to_customer_delivery", "ready_for_delivery"].includes(
          order.orderStatus
        )
      ) {
        return jsonError("Order tidak dalam stage delivery", 422);
      }

      if (order.orderStatus === "ready_for_delivery") {
        await updateOrderStatus({
          orderId,
          newStatus: "courier_to_customer_delivery",
          changedBy: session.id,
          note: "Langsung antar",
          notifyCustomer: false,
        });
      }

      const existingProof = await prisma.deliveryProof.findUnique({
        where: { orderId },
      });
      if (!existingProof) {
        await prisma.deliveryProof.create({
          data: {
            orderId,
            courierId: session.id,
            recipientName: name,
            photoUrl: body.deliveryPhoto || "delivery-proof-admin",
            notes: body.deliveryNote || null,
          },
        });
      }

      const result = await updateOrderStatus({
        orderId,
        newStatus: "delivered",
        changedBy: session.id,
        note: `Diterima oleh ${name}`,
      });
      if (!result.ok) return jsonError(result.error, 422);
      return jsonOk(result.data);
    }

    return jsonError("Unknown logistics step");
  }

  // --- WEIGHING ---
  if (action === "weigh") {
    if (session.role !== "admin") return jsonForbidden();
    const actualWeight = Number(body.actualWeight);
    const calc = await calculateActualPrice(orderId, actualWeight);
    if (!calc.ok) return jsonError(calc.error, 422);

    const { data } = calc;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        actualWeight: data.actualWeight,
        estimatedWeight: data.actualWeight,
        actualLaundryPrice: data.actualLaundryPrice,
        estimatedLaundryPrice: data.actualLaundryPrice,
        subtotal: data.actualSubtotal,
        total: data.actualTotal,
        discount: data.discount,
        remainingAmount: data.additionalPayment,
        paymentStatus:
          data.additionalPayment > 0
            ? order.paidAmount > 0
              ? "partial"
              : "pending"
            : "paid",
        orderStatus: "weighing",
      },
    });

    await recordStatusHistory({
      orderId,
      status: "weighing",
      changedBy: session.id,
      note: `Berat aktual: ${data.actualWeight} KG — tagihan laundry + ongkir dihitung di outlet`,
    });

    if (data.additionalPayment > 0) {
      await prisma.payment.create({
        data: {
          orderId,
          userId: order.customerId,
          amount: data.additionalPayment,
          paymentType: "additional",
          paymentMethod: "qris",
          status: "pending",
          transactionId: `TXN-ADD-${order.orderNumber}`,
        },
      });

      const result = await updateOrderStatus({
        orderId,
        newStatus: "waiting_additional_payment",
        changedBy: session.id,
        note: `Tagihan laundry + ongkir: Rp${data.additionalPayment}`,
      });
      if (!result.ok) return jsonError(result.error, 422);

      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, service: true },
      });
      return jsonOk({
        order: updated,
        additionalPayment: data.additionalPayment,
        requiresPayment: true,
      });
    }

    // Nothing more due — go to washing
    const result = await updateOrderStatus({
      orderId,
      newStatus: "washing",
      changedBy: session.id,
      note: "Sudah lunas setelah penimbangan, lanjut proses",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk({ order: result.data, requiresPayment: false });
  }

  // --- CANCEL ---
  if (action === "cancel") {
    if (session.role === "customer" && order.customerId !== session.id) {
      return jsonForbidden();
    }
    if (session.role === "courier") return jsonForbidden();

    const result = await updateOrderStatus({
      orderId,
      newStatus: "cancelled",
      changedBy: session.id,
      note: body.note || "Order dibatalkan",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  // --- RATE ---
  if (action === "rate") {
    if (session.role !== "customer" || order.customerId !== session.id) {
      return jsonForbidden();
    }
    if (order.orderStatus !== "completed" && order.orderStatus !== "delivered") {
      return jsonError("Order belum selesai");
    }

    const existing = await prisma.rating.findUnique({ where: { orderId } });
    if (existing) return jsonError("Anda sudah memberikan rating");

    const laundryRating = Number(body.laundryRating);
    const courierRating = body.courierRating
      ? Number(body.courierRating)
      : undefined;
    if (laundryRating < 1 || laundryRating > 5) {
      return jsonError("Rating harus 1-5");
    }

    const rating = await prisma.rating.create({
      data: {
        orderId,
        customerId: session.id,
        courierId: order.courierId,
        laundryRating,
        courierRating,
        comment: body.comment,
      },
    });

    if (order.courierId && courierRating) {
      const ratings = await prisma.rating.findMany({
        where: { courierId: order.courierId, courierRating: { not: null } },
      });
      const avg =
        ratings.reduce((s, r) => s + (r.courierRating || 0), 0) / ratings.length;
      await prisma.user.update({
        where: { id: order.courierId },
        data: { rating: Math.round(avg * 10) / 10 },
      });
    }

    if (order.orderStatus === "delivered") {
      await updateOrderStatus({
        orderId,
        newStatus: "completed",
        changedBy: session.id,
        note: "Customer memberikan rating",
      });
    }

    return jsonOk(rating);
  }

  return jsonError("Unknown action");
}
