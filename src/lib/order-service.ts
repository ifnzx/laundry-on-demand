import { prisma } from "@/lib/db";
import { canTransition, STATUS_LABELS } from "@/lib/order-status";
import {
  createAuditLog,
  createNotification,
  recordStatusHistory,
  STATUS_NOTIFICATIONS,
} from "@/lib/notifications";
import { accrueFeeForOrder } from "@/lib/platform-billing";

export async function updateOrderStatus(params: {
  orderId: string;
  newStatus: string;
  changedBy?: string;
  note?: string;
  notifyCustomer?: boolean;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
  });
  if (!order) {
    return { ok: false as const, error: "Order tidak ditemukan" };
  }

  if (!canTransition(order.orderStatus, params.newStatus) && params.newStatus !== "cancelled") {
    // Allow admin cancel from most states
    if (!(params.newStatus === "cancelled" && order.orderStatus !== "completed" && order.orderStatus !== "cancelled")) {
      return {
        ok: false as const,
        error: `Tidak dapat mengubah status dari ${STATUS_LABELS[order.orderStatus] || order.orderStatus} ke ${STATUS_LABELS[params.newStatus] || params.newStatus}`,
      };
    }
  }

  // Special cancel handling from non-terminal
  if (
    params.newStatus === "cancelled" &&
    (order.orderStatus === "completed" || order.orderStatus === "cancelled")
  ) {
    return { ok: false as const, error: "Order sudah selesai atau dibatalkan" };
  }

  const updated = await prisma.order.update({
    where: { id: params.orderId },
    data: {
      orderStatus: params.newStatus,
      completedAt:
        params.newStatus === "completed" ? new Date() : order.completedAt,
    },
  });

  await recordStatusHistory({
    orderId: params.orderId,
    status: params.newStatus,
    changedBy: params.changedBy,
    note: params.note,
  });

  // SaaS: 1 fee per completed order (idempotent)
  if (params.newStatus === "completed") {
    try {
      await accrueFeeForOrder(params.orderId, updated.completedAt || new Date());
    } catch (e) {
      console.error("[platform-billing] accrue failed", e);
    }
  }

  if (params.notifyCustomer !== false) {
    const notif = STATUS_NOTIFICATIONS[params.newStatus];
    if (notif) {
      await createNotification({
        userId: order.customerId,
        orderId: order.id,
        title: notif.title,
        message: `${notif.message} (${order.orderNumber})`,
      });
    }
  }

  // Notify admin-handled logistics as "team" (courierId may be admin)
  if (
    (params.newStatus === "courier_assigned" ||
      params.newStatus === "courier_to_customer") &&
    order.courierId
  ) {
    // skip notify courier if same as admin or admin-handler — already notified customer
  }

  await createAuditLog({
    userId: params.changedBy,
    action: "status_change",
    entity: "order",
    entityId: order.id,
    oldValue: { status: order.orderStatus },
    newValue: { status: params.newStatus },
  });

  return { ok: true as const, data: updated };
}
