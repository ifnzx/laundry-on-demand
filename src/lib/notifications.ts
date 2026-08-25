import { prisma } from "./db";

export async function createNotification(params: {
  userId: string;
  orderId?: string;
  title: string;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      orderId: params.orderId,
      title: params.title,
      message: params.message,
    },
  });
}

export async function recordStatusHistory(params: {
  orderId: string;
  status: string;
  changedBy?: string;
  note?: string;
}) {
  return prisma.orderStatusHistory.create({
    data: {
      orderId: params.orderId,
      status: params.status,
      changedBy: params.changedBy,
      note: params.note,
    },
  });
}

export async function createAuditLog(params: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      oldValue: params.oldValue
        ? JSON.stringify(params.oldValue)
        : undefined,
      newValue: params.newValue
        ? JSON.stringify(params.newValue)
        : undefined,
    },
  });
}

export const STATUS_NOTIFICATIONS: Record<
  string,
  { title: string; message: string }
> = {
  paid: {
    title: "Pembayaran Berhasil",
    message: "Pembayaran Anda berhasil. Pesanan sedang diproses.",
  },
  waiting_courier: {
    title: "Menunggu Jemput",
    message: "Pesanan Anda menunggu diambil oleh tim outlet.",
  },
  courier_assigned: {
    title: "Siap Diambil",
    message: "Tim outlet akan segera menjemput laundry Anda.",
  },
  courier_to_customer: {
    title: "Tim Menuju Lokasi",
    message: "Tim outlet sedang menuju lokasi pickup Anda.",
  },
  picked_up: {
    title: "Laundry Diambil",
    message: "Laundry Anda berhasil diambil.",
  },
  received_at_outlet: {
    title: "Diterima di Outlet",
    message: "Laundry Anda telah diterima di outlet.",
  },
  weighing: {
    title: "Penimbangan",
    message: "Laundry Anda sedang ditimbang.",
  },
  waiting_additional_payment: {
    title: "Tagihan Siap Dibayar",
    message:
      "Berat sudah ditimbang. Silakan bayar laundry + ongkir untuk lanjut proses.",
  },
  washing: {
    title: "Sedang Dicuci",
    message: "Laundry Anda sedang dalam proses pencucian.",
  },
  drying: {
    title: "Sedang Dijemur",
    message: "Laundry Anda sedang dijemur / dikeringkan.",
  },
  ironing: {
    title: "Sedang Disetrika",
    message: "Laundry Anda sedang disetrika.",
  },
  packing: {
    title: "Sedang Dikemas",
    message: "Laundry Anda sedang dikemas.",
  },
  ready_for_delivery: {
    title: "Siap Diantar",
    message: "Laundry Anda siap diantar kembali.",
  },
  courier_to_customer_delivery: {
    title: "Sedang Diantar",
    message: "Tim outlet sedang mengantar laundry ke alamat Anda.",
  },
  delivered: {
    title: "Laundry Diterima",
    message: "Laundry telah sampai. Terima kasih!",
  },
  completed: {
    title: "Pesanan Selesai",
    message: "Pesanan selesai. Berikan rating untuk layanan kami.",
  },
  cancelled: {
    title: "Pesanan Dibatalkan",
    message: "Pesanan Anda telah dibatalkan.",
  },
};
