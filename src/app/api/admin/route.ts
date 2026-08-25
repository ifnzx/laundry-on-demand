import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireRole, hashPassword } from "@/lib/auth";
import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api";
import { createAuditLog } from "@/lib/notifications";
import { getSettings } from "@/lib/pricing";
import {
  getBillingSummary,
  markInvoicePaid,
  assertBillingAllowed,
} from "@/lib/platform-billing";
import {
  getPaymentAccounts,
  savePaymentAccounts,
  type PaymentAccount,
} from "@/lib/payment-accounts";
import { z } from "zod";
import { jsonValidation } from "@/lib/api";

/** Monday 00:00:00 of the week containing `d` */
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(weekStart: Date) {
  const x = new Date(weekStart);
  x.setDate(x.getDate() + 7);
  return x;
}

function weekLabel(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return `${fmt(weekStart)}–${fmt(end)}`;
}

async function buildWeeklyOrderSeries(weeks = 8) {
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const series: {
    weekStart: string;
    label: string;
    total: number;
    completed: number;
  }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    const end = endOfWeek(start);

    const [total, completed] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: start, lt: end },
          orderStatus: "completed",
        },
      }),
    ]);

    series.push({
      weekStart: start.toISOString(),
      label: weekLabel(start),
      total,
      completed,
    });
  }

  return series;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const resource = new URL(req.url).searchParams.get("resource") || "dashboard";

  if (resource === "dashboard") {
    const [
      totalOrders,
      activeOrders,
      completedOrders,
      customers,
      couriers,
      revenueAgg,
      recentOrders,
      services,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          orderStatus: {
            notIn: ["completed", "cancelled", "pending_payment"],
          },
        },
      }),
      prisma.order.count({ where: { orderStatus: "completed" } }),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.user.count({ where: { role: "courier" } }),
      prisma.order.aggregate({
        where: { paymentStatus: { in: ["paid", "partial"] } },
        _sum: { paidAmount: true },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true } },
          service: { select: { name: true } },
        },
      }),
      prisma.service.findMany({ where: { status: "active" } }),
    ]);

    // Popular services
    const orderCounts = await prisma.order.groupBy({
      by: ["serviceId"],
      _count: true,
    });
    const popularServices = orderCounts
      .map((oc) => {
        const s = services.find((x) => x.id === oc.serviceId);
        return { name: s?.name || "Unknown", count: oc._count };
      })
      .sort((a, b) => b.count - a.count);

    // Courier performance (kept for API consumers)
    const courierUsers = await prisma.user.findMany({
      where: { role: "courier" },
      select: { id: true, name: true, rating: true, isOnline: true },
    });
    const courierPerf = await Promise.all(
      courierUsers.map(async (c) => {
        const count = await prisma.order.count({
          where: {
            courierId: c.id,
            orderStatus: { in: ["delivered", "completed"] },
          },
        });
        return { ...c, completedJobs: count };
      })
    );

    // Analisa order 8 minggu terakhir (Minggu → Senin-Minggu lokal)
    const weeklyOrders = await buildWeeklyOrderSeries(8);

    return jsonOk({
      totalOrders,
      activeOrders,
      completedOrders,
      revenue: revenueAgg._sum.paidAmount || 0,
      customers,
      couriers,
      recentOrders,
      popularServices,
      courierPerformance: courierPerf,
      weeklyOrders,
    });
  }

  if (resource === "customers") {
    const customers = await prisma.user.findMany({
      where: { role: "customer" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withSpend = await Promise.all(
      customers.map(async (c) => {
        const spend = await prisma.order.aggregate({
          where: { customerId: c.id, paymentStatus: { in: ["paid", "partial"] } },
          _sum: { paidAmount: true },
        });
        return {
          ...c,
          orderCount: c._count.orders,
          totalSpent: spend._sum.paidAmount || 0,
        };
      })
    );
    return jsonOk(withSpend);
  }

  if (resource === "couriers") {
    const couriers = await prisma.user.findMany({
      where: { role: "courier" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        vehicle: true,
        status: true,
        isOnline: true,
        rating: true,
        photo: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    return jsonOk(couriers);
  }

  if (resource === "outlets") {
    const outlets = await prisma.outlet.findMany({ orderBy: { name: "asc" } });
    return jsonOk(outlets);
  }

  if (resource === "promos") {
    const promos = await prisma.promo.findMany({
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(promos);
  }

  if (resource === "settings") {
    const settings = await getSettings();
    const all = await prisma.setting.findMany();
    return jsonOk({ ...settings, all });
  }

  if (resource === "payment_accounts") {
    const accounts = await getPaymentAccounts();
    return jsonOk(accounts);
  }

  if (resource === "laundry") {
    // Kanban data
    const statuses = [
      "received_at_outlet",
      "weighing",
      "waiting_additional_payment",
      "washing",
      "drying",
      "ironing",
      "packing",
      "ready_for_delivery",
    ];
    const orders = await prisma.order.findMany({
      where: { orderStatus: { in: statuses } },
      include: {
        customer: { select: { name: true, phone: true } },
        service: true,
      },
      orderBy: { updatedAt: "asc" },
    });
    return jsonOk(orders);
  }

  if (resource === "reports") {
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: last30 } },
      select: {
        createdAt: true,
        total: true,
        paidAmount: true,
        orderStatus: true,
        paymentStatus: true,
      },
    });
    return jsonOk({ orders, period: "30d" });
  }

  if (resource === "billing") {
    const summary = await getBillingSummary();
    return jsonOk(summary);
  }

  return jsonError("Unknown resource");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  const { action } = body;

  // Saat dikunci, hanya pelunasan tagihan platform yang boleh
  const allowWhenLocked = ["mark_platform_invoice_paid"];
  if (!allowWhenLocked.includes(action)) {
    const billing = await assertBillingAllowed();
    if (!billing.ok) return jsonError(billing.error, 423);
  }

  if (action === "create_courier") {
    const schema = z.object({
      name: z.string().min(2),
      phone: z.string().min(10),
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().min(6).default("password123"),
      vehicle: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation("Data tidak valid", parsed.error.flatten());
    }

    const exists = await prisma.user.findUnique({
      where: { phone: parsed.data.phone },
    });
    if (exists) return jsonError("Nomor sudah terdaftar");

    const hashed = await hashPassword(parsed.data.password);
    const courier = await prisma.user.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        password: hashed,
        role: "courier",
        vehicle: parsed.data.vehicle,
      },
    });
    await createAuditLog({
      userId: auth.user.id,
      action: "create_courier",
      entity: "user",
      entityId: courier.id,
    });
    return jsonOk(
      {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        vehicle: courier.vehicle,
      },
      201
    );
  }

  if (action === "update_courier") {
    const { id, ...data } = body;
    if (!id) return jsonError("ID wajib");
    const courier = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        vehicle: data.vehicle,
        status: data.status,
      },
    });
    await createAuditLog({
      userId: auth.user.id,
      action: "update_courier",
      entity: "user",
      entityId: id,
    });
    return jsonOk(courier);
  }

  if (action === "update_customer_status") {
    const { id, status } = body;
    if (!id || !status) return jsonError("id dan status wajib");
    const customer = await prisma.user.update({
      where: { id },
      data: { status },
    });
    await createAuditLog({
      userId: auth.user.id,
      action: "update_customer_status",
      entity: "user",
      entityId: id,
      newValue: { status },
    });
    return jsonOk(customer);
  }

  if (action === "update_settings") {
    const keys = ["base_fee", "price_per_km", "maximum_distance"] as const;
    for (const key of keys) {
      if (body[key] !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        });
      }
    }
    await createAuditLog({
      userId: auth.user.id,
      action: "update_pricing",
      entity: "settings",
      newValue: body,
    });
    const settings = await getSettings();
    return jsonOk(settings);
  }

  if (action === "update_payment_accounts") {
    const accountSchema = z.object({
      id: z.string().min(1).optional(),
      provider: z.string().min(1),
      label: z.string().min(1).max(80),
      accountName: z.string().max(120).optional().default(""),
      accountNumber: z.string().max(80).optional().default(""),
      notes: z.string().max(500).optional().default(""),
      enabled: z.boolean().optional().default(true),
      sortOrder: z.number().optional(),
    });
    const schema = z.object({
      accounts: z.array(accountSchema).min(1).max(30),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation("Data rekening tidak valid", parsed.error.flatten());
    }
    try {
      const saved = await savePaymentAccounts(
        parsed.data.accounts as PaymentAccount[]
      );
      await createAuditLog({
        userId: auth.user.id,
        action: "update_payment_accounts",
        entity: "settings",
        entityId: "payment_accounts",
        newValue: { count: saved.length },
      });
      return jsonOk(saved);
    } catch (e) {
      return jsonError(
        e instanceof Error ? e.message : "Gagal menyimpan rekening"
      );
    }
  }

  if (action === "mark_platform_invoice_paid") {
    const { invoiceId, note } = body;
    if (!invoiceId) return jsonError("invoiceId wajib");
    const result = await markInvoicePaid({
      invoiceId,
      note: note || "Pembayaran fee platform dicatat admin",
      userId: auth.user.id,
    });
    if (!result.ok) return jsonError(result.error);
    await createAuditLog({
      userId: auth.user.id,
      action: "mark_platform_invoice_paid",
      entity: "platform_invoice",
      entityId: invoiceId,
      newValue: { note },
    });
    const summary = await getBillingSummary();
    return jsonOk(summary);
  }

  if (action === "create_outlet") {
    const outlet = await prisma.outlet.create({
      data: {
        name: body.name,
        address: body.address,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        phone: body.phone,
        serviceRadiusKm: Number(body.serviceRadiusKm || 10),
        status: body.status || "active",
      },
    });
    return jsonOk(outlet, 201);
  }

  if (action === "update_outlet") {
    const { id, ...data } = body;
    const outlet = await prisma.outlet.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        latitude: data.latitude !== undefined ? Number(data.latitude) : undefined,
        longitude:
          data.longitude !== undefined ? Number(data.longitude) : undefined,
        phone: data.phone,
        serviceRadiusKm:
          data.serviceRadiusKm !== undefined
            ? Number(data.serviceRadiusKm)
            : undefined,
        status: data.status,
      },
    });
    return jsonOk(outlet);
  }

  if (action === "create_promo") {
    const promo = await prisma.promo.create({
      data: {
        code: String(body.code).toUpperCase(),
        name: body.name,
        type: body.type,
        value: Number(body.value),
        minimumOrder: Number(body.minimumOrder || 0),
        maximumDiscount: body.maximumDiscount
          ? Number(body.maximumDiscount)
          : null,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        status: body.status || "active",
      },
    });
    return jsonOk(promo, 201);
  }

  if (action === "update_promo") {
    const { id, ...data } = body;
    const promo = await prisma.promo.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
        value: data.value !== undefined ? Number(data.value) : undefined,
      },
    });
    return jsonOk(promo);
  }

  if (action === "receive_at_outlet") {
    // Move picked_up → received_at_outlet
    const { orderId } = body;
    if (!orderId) return jsonError("orderId wajib");
    const { updateOrderStatus } = await import("@/lib/order-service");
    const result = await updateOrderStatus({
      orderId,
      newStatus: "received_at_outlet",
      changedBy: auth.user.id,
      note: "Laundry diterima di outlet",
    });
    if (!result.ok) return jsonError(result.error, 422);
    return jsonOk(result.data);
  }

  return jsonError("Unknown action");
}
