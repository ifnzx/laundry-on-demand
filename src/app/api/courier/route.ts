import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api";
import { updateOrderStatus } from "@/lib/order-service";
import { recordStatusHistory } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["courier"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const type = new URL(req.url).searchParams.get("type"); // pickup | delivery | all | earnings

  if (type === "earnings") {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Earnings = delivery fee portion for completed trips
    const completedOrders = await prisma.order.findMany({
      where: {
        courierId: auth.user.id,
        orderStatus: { in: ["delivered", "completed"] },
      },
      select: { deliveryFee: true, completedAt: true, updatedAt: true, createdAt: true },
    });

    // Courier earns full delivery fee as MVP simplification
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let total = 0;

    for (const o of completedOrders) {
      const d = o.completedAt || o.updatedAt;
      const fee = o.deliveryFee;
      total += fee;
      if (d >= startOfDay) today += fee;
      if (d >= startOfWeek) thisWeek += fee;
      if (d >= startOfMonth) thisMonth += fee;
    }

    const courier = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { isOnline: true, rating: true, name: true, vehicle: true },
    });

    const todayPickups = await prisma.order.count({
      where: {
        courierId: auth.user.id,
        orderStatus: {
          in: ["courier_assigned", "courier_to_customer", "picked_up"],
        },
      },
    });

    const todayDeliveries = await prisma.order.count({
      where: {
        courierId: auth.user.id,
        orderStatus: {
          in: ["ready_for_delivery", "courier_to_customer_delivery"],
        },
      },
    });

    return jsonOk({
      today,
      thisWeek,
      thisMonth,
      total,
      todayPickups,
      todayDeliveries,
      courier,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { courierId: auth.user.id };

  if (type === "pickup") {
    where.orderStatus = {
      in: ["courier_assigned", "courier_to_customer", "picked_up"],
    };
  } else if (type === "delivery") {
    where.orderStatus = {
      in: ["ready_for_delivery", "courier_to_customer_delivery"],
    };
  } else if (type === "active") {
    where.orderStatus = {
      in: [
        "courier_assigned",
        "courier_to_customer",
        "picked_up",
        "ready_for_delivery",
        "courier_to_customer_delivery",
      ],
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      service: true,
      address: true,
      customer: { select: { id: true, name: true, phone: true } },
      outlet: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(orders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["courier"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  const { action, orderId } = body;

  if (action === "toggle_online") {
    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: { isOnline: Boolean(body.isOnline) },
    });
    return jsonOk({ isOnline: user.isOnline });
  }

  if (!orderId) return jsonError("orderId wajib");

  const order = await prisma.order.findFirst({
    where: { id: orderId, courierId: auth.user.id },
  });
  if (!order) return jsonError("Order tidak ditemukan", 404);

  if (action === "accept") {
    // Already assigned; move to en route
    const result = await updateOrderStatus({
      orderId,
      newStatus: "courier_to_customer",
      changedBy: auth.user.id,
      note: "Kurir menerima order dan menuju customer",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  if (action === "reject") {
    await prisma.order.update({
      where: { id: orderId },
      data: { courierId: null, assignedAt: null },
    });
    const result = await updateOrderStatus({
      orderId,
      newStatus: "waiting_courier",
      changedBy: auth.user.id,
      note: "Kurir menolak order, menunggu assign ulang",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  if (action === "arrived") {
    // stay on courier_to_customer, just note
    await recordStatusHistory({
      orderId,
      status: order.orderStatus,
      changedBy: auth.user.id,
      note: "Kurir tiba di lokasi customer",
    });
    return jsonOk({ message: "Arrived marked" });
  }

  if (action === "confirm_pickup") {
    if (body.pickupPhoto) {
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupPhoto: body.pickupPhoto },
      });
    }
    const result = await updateOrderStatus({
      orderId,
      newStatus: "picked_up",
      changedBy: auth.user.id,
      note: "Laundry berhasil diambil",
    });
    if (!result.ok) return jsonError(result.error, 422);

    // Auto mark received at outlet for MVP speed (admin can also do it)
    // Actually per PRD admin receives at outlet - leave as picked_up
    return jsonOk(result.data);
  }

  if (action === "start_delivery") {
    const result = await updateOrderStatus({
      orderId,
      newStatus: "courier_to_customer_delivery",
      changedBy: auth.user.id,
      note: "Kurir mulai mengantar",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  if (action === "confirm_delivery") {
    if (!body.recipientName) {
      return jsonError("Nama penerima wajib diisi");
    }

    await prisma.deliveryProof.create({
      data: {
        orderId,
        courierId: auth.user.id,
        recipientName: body.recipientName,
        photoUrl: body.deliveryPhoto || null,
        notes: body.deliveryNote || null,
      },
    });

    const result = await updateOrderStatus({
      orderId,
      newStatus: "delivered",
      changedBy: auth.user.id,
      note: `Diterima oleh ${body.recipientName}`,
    });
    if (!result.ok) return jsonError(result.error, 422);

    // Complete if no rating required immediately for courier side
    return jsonOk(result.data);
  }

  return jsonError("Unknown action");
}
