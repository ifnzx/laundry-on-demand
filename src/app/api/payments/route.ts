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
import { createAuditLog } from "@/lib/notifications";
import { accrueFeeForOrder } from "@/lib/platform-billing";
import { getEnabledPaymentAccounts } from "@/lib/payment-accounts";

async function applyPaymentToOrder(params: {
  orderId: string;
  amount: number;
  adminUserId: string;
  paymentType: string;
  note?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
  });
  if (!order) return { ok: false as const, error: "Order tidak ditemukan" };

  const prevPaid = order.paidAmount;
  const newPaidAmount = order.paidAmount + params.amount;
  const remaining = Math.max(0, order.total - newPaidAmount);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paidAmount: newPaidAmount,
      remainingAmount: remaining,
      paymentStatus: remaining > 0 ? "partial" : "paid",
    },
  });

  // SaaS: 1 fee per transaksi (saat pembayaran pertama order berhasil)
  if (prevPaid <= 0 && params.amount > 0) {
    try {
      await accrueFeeForOrder(order.id, new Date());
    } catch (e) {
      console.error("[platform-billing] accrue on payment failed", e);
    }
  }

  if (
    (params.paymentType === "initial" || params.paymentType === "manual") &&
    order.orderStatus === "pending_payment"
  ) {
    await updateOrderStatus({
      orderId: order.id,
      newStatus: "paid",
      changedBy: params.adminUserId,
      note: params.note || "Pembayaran dicatat admin",
    });
    await updateOrderStatus({
      orderId: order.id,
      newStatus: "waiting_courier",
      changedBy: params.adminUserId,
      note: "Menunggu jemput oleh tim outlet",
    });
  }

  if (
    params.paymentType === "additional" &&
    order.orderStatus === "waiting_additional_payment"
  ) {
    await updateOrderStatus({
      orderId: order.id,
      newStatus: "washing",
      changedBy: params.adminUserId,
      note: params.note || "Pembayaran tambahan dicatat admin, lanjut pencucian",
    });
  }

  // Manual payment on remaining while waiting additional
  if (
    params.paymentType === "manual" &&
    order.orderStatus === "waiting_additional_payment" &&
    remaining === 0
  ) {
    await updateOrderStatus({
      orderId: order.id,
      newStatus: "washing",
      changedBy: params.adminUserId,
      note: params.note || "Sisa dibayar, lanjut pencucian",
    });
  }

  return { ok: true as const };
}

/**
 * Payment endpoints:
 * - POST confirm: verify pending payment (customer/admin)
 * - POST record: admin creates & marks paid (cash / transfer manual)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  try {
    const body = await req.json();

    // --- ADMIN RECORD PAYMENT ---
    if (body.action === "record") {
      if (session.role !== "admin") return jsonForbidden();

      const orderId = body.orderId as string;
      if (!orderId) return jsonError("orderId wajib");

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      if (!order) return jsonError("Order tidak ditemukan", 404);

      const method = (body.paymentMethod || "cash") as string;
      const allowedMethods = [
        "cash",
        "qris",
        "bank_transfer",
        "ewallet",
        "dana",
        "gopay",
        "ovo",
        "shopeepay",
      ];
      if (!allowedMethods.includes(method)) {
        return jsonError("Metode pembayaran tidak valid");
      }

      let amount = Number(body.amount);
      if (!amount || amount <= 0) {
        // default: remaining or full total
        amount =
          order.remainingAmount > 0
            ? order.remainingAmount
            : Math.max(0, order.total - order.paidAmount);
      }
      if (amount <= 0) {
        return jsonError("Tidak ada sisa pembayaran");
      }

      // Cap at remaining so we don't overpay accidentally; allow partial
      const maxPay =
        order.remainingAmount > 0
          ? order.remainingAmount
          : Math.max(0, order.total - order.paidAmount);
      if (amount > maxPay && maxPay > 0) {
        amount = maxPay;
      }

      let paymentType = (body.paymentType as string) || "manual";
      if (order.orderStatus === "pending_payment") paymentType = "initial";
      if (order.orderStatus === "waiting_additional_payment") {
        paymentType = "additional";
      }

      // Avoid double-count: cancel leftover pending rows for this order
      await prisma.payment.updateMany({
        where: { orderId: order.id, status: "pending" },
        data: { status: "cancelled" },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.customerId,
          amount,
          paymentType,
          paymentMethod: method,
          status: "paid",
          paidAt: new Date(),
          transactionId: body.transactionId || `ADM-${Date.now()}`,
        },
      });

      const applied = await applyPaymentToOrder({
        orderId: order.id,
        amount,
        adminUserId: session.id,
        paymentType,
        note: body.note || `Pembayaran ${method} dicatat admin`,
      });
      if (!applied.ok) return jsonError(applied.error);

      await createAuditLog({
        userId: session.id,
        action: "payment_recorded",
        entity: "payment",
        entityId: payment.id,
        newValue: { amount, method, orderId: order.id },
      });

      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          payments: { orderBy: { createdAt: "desc" } },
          service: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      return jsonOk({ payment, order: finalOrder }, 201);
    }

    // --- CONFIRM EXISTING PENDING PAYMENT (customer / admin sim) ---
    const { paymentId, orderId, paymentMethod } = body;

    let payment;
    if (paymentId) {
      payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });
    } else if (orderId) {
      payment = await prisma.payment.findFirst({
        where: { orderId, status: "pending" },
        include: { order: true },
        orderBy: { createdAt: "desc" },
      });
    }

    // Jika belum ada baris pending tapi order masih butuh bayar, buat dulu (simulasi)
    if (!payment && orderId && session.role === "customer") {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (
        order &&
        order.customerId === session.id &&
        (order.orderStatus === "pending_payment" ||
          order.orderStatus === "waiting_additional_payment")
      ) {
        const amt =
          order.remainingAmount > 0
            ? order.remainingAmount
            : Math.max(0, order.total - order.paidAmount);
        if (amt > 0) {
          payment = await prisma.payment.create({
            data: {
              orderId: order.id,
              userId: session.id,
              amount: amt,
              paymentType:
                order.orderStatus === "waiting_additional_payment"
                  ? "additional"
                  : "initial",
              paymentMethod: paymentMethod || "qris",
              status: "pending",
              transactionId: `TXN-${Date.now()}`,
            },
            include: { order: true },
          });
        }
      }
    }

    if (!payment) return jsonError("Payment tidak ditemukan", 404);

    if (session.role === "customer" && payment.userId !== session.id) {
      return jsonForbidden();
    }
    if (session.role === "courier") return jsonForbidden();

    if (payment.status === "paid") {
      return jsonOk({ payment, message: "Sudah dibayar" });
    }

    const method =
      paymentMethod ||
      (session.role === "admin" ? body.method : null) ||
      payment.paymentMethod;

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentMethod: method,
        transactionId: payment.transactionId || `TXN-${Date.now()}`,
      },
    });

    const applied = await applyPaymentToOrder({
      orderId: payment.orderId,
      amount: payment.amount,
      adminUserId: session.id,
      paymentType: payment.paymentType,
      note:
        session.role === "admin"
          ? `Pembayaran dikonfirmasi admin (${method})`
          : "Pembayaran berhasil diverifikasi",
    });
    if (!applied.ok) return jsonError(applied.error);

    await createAuditLog({
      userId: session.id,
      action: "payment_verified",
      entity: "payment",
      entityId: payment.id,
      newValue: {
        amount: payment.amount,
        status: "paid",
        by: session.role,
      },
    });

    const finalOrder = await prisma.order.findUnique({
      where: { id: payment.orderId },
      include: { payments: true, service: true },
    });

    return jsonOk({ payment: updatedPayment, order: finalOrder });
  } catch (e) {
    console.error(e);
    return jsonError("Gagal memproses pembayaran", 500);
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin", "customer"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("resource") === "accounts") {
    const accounts = await getEnabledPaymentAccounts();
    return jsonOk(accounts);
  }

  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (auth.user.role === "customer") where.userId = auth.user.id;
  if (orderId) where.orderId = orderId;
  if (status) where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          total: true,
          paidAmount: true,
          remainingAmount: true,
          paymentStatus: true,
        },
      },
      user: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(payments);
}
