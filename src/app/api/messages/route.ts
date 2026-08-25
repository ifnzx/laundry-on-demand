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
import { createNotification } from "@/lib/notifications";
import { saveChatImage } from "@/lib/chat-image";

const sendSchema = z
  .object({
    orderId: z.string().min(1),
    body: z.string().trim().max(2000).optional().default(""),
    /** data:image/...;base64,... */
    image: z.string().max(2_500_000).optional(),
  })
  .refine((d) => (d.body && d.body.length > 0) || (d.image && d.image.length > 0), {
    message: "Pesan atau foto wajib diisi",
  });

async function canAccessOrder(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
    },
  });
  if (!order) return { ok: false as const, error: "Order tidak ditemukan" };
  if (role === "admin") return { ok: true as const, order };
  if (role === "customer" && order.customerId === userId) {
    return { ok: true as const, order };
  }
  return { ok: false as const, error: "Akses ditolak" };
}

function mapMsg(
  m: {
    id: string;
    body: string;
    imageUrl?: string | null;
    createdAt: Date;
    isRead: boolean;
    senderId: string;
    sender: { id: string; name: string; role: string };
  },
  sessionId: string
) {
  return {
    id: m.id,
    body: m.body,
    imageUrl: m.imageUrl || null,
    createdAt: m.createdAt,
    isRead: m.isRead,
    isMine: m.senderId === sessionId,
    sender: m.sender,
  };
}

/** List inbox (admin) or thread messages */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const inbox = searchParams.get("inbox") === "true";
  const unreadOnly = searchParams.get("unreadCount") === "true";

  if (unreadOnly) {
    if (session.role === "admin") {
      const n = await prisma.orderMessage.count({
        where: {
          isRead: false,
          sender: { role: "customer" },
        },
      });
      return jsonOk({ unread: n });
    }
    if (session.role === "customer") {
      const n = await prisma.orderMessage.count({
        where: {
          isRead: false,
          sender: { role: { in: ["admin", "courier"] } },
          order: { customerId: session.id },
        },
      });
      return jsonOk({ unread: n });
    }
    return jsonOk({ unread: 0 });
  }

  if (inbox) {
    if (session.role !== "admin" && session.role !== "customer") {
      return jsonForbidden();
    }

    const isCustomer = session.role === "customer";
    const messages = await prisma.orderMessage.findMany({
      where: isCustomer
        ? { order: { customerId: session.id } }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        sender: { select: { id: true, name: true, role: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderStatus: true,
            outlet: { select: { name: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    const byOrder = new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        orderStatus: string;
        customerName: string;
        outletName: string | null;
        lastBody: string;
        lastAt: string;
        lastSenderRole: string;
        unread: number;
      }
    >();

    for (const m of messages) {
      if (!byOrder.has(m.orderId)) {
        byOrder.set(m.orderId, {
          orderId: m.orderId,
          orderNumber: m.order.orderNumber,
          orderStatus: m.order.orderStatus,
          customerName: m.order.customer.name,
          outletName: m.order.outlet?.name || null,
          lastBody: m.imageUrl
            ? m.body
              ? `📷 ${m.body}`
              : "📷 Foto"
            : m.body,
          lastAt: m.createdAt.toISOString(),
          lastSenderRole: m.sender.role,
          unread: 0,
        });
      }
    }

    const unreadRows = await prisma.orderMessage.groupBy({
      by: ["orderId"],
      where: {
        isRead: false,
        ...(isCustomer
          ? {
              sender: { role: { in: ["admin", "courier"] } },
              order: { customerId: session.id },
            }
          : { sender: { role: "customer" } }),
      },
      _count: { id: true },
    });
    for (const u of unreadRows) {
      const row = byOrder.get(u.orderId);
      if (row) row.unread = u._count.id;
    }

    const list = Array.from(byOrder.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
    return jsonOk(list);
  }

  if (!orderId) return jsonError("orderId wajib");

  const access = await canAccessOrder(orderId, session.id, session.role);
  if (!access.ok) {
    return access.error === "Order tidak ditemukan"
      ? jsonError(access.error, 404)
      : jsonForbidden();
  }

  const messages = await prisma.orderMessage.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  if (session.role === "admin") {
    await prisma.orderMessage.updateMany({
      where: {
        orderId,
        isRead: false,
        sender: { role: "customer" },
      },
      data: { isRead: true },
    });
  } else if (session.role === "customer") {
    await prisma.orderMessage.updateMany({
      where: {
        orderId,
        isRead: false,
        sender: { role: { in: ["admin", "courier"] } },
      },
      data: { isRead: true },
    });
  }

  return jsonOk({
    order: {
      id: access.order.id,
      orderNumber: access.order.orderNumber,
      customerName: access.order.customer.name,
    },
    messages: messages.map((m) => mapMsg(m, session.id)),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer", "admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body tidak valid");
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidation(
      "Pesan tidak valid (teks atau foto wajib)",
      parsed.error.flatten()
    );
  }

  const access = await canAccessOrder(
    parsed.data.orderId,
    auth.user.id,
    auth.user.role
  );
  if (!access.ok) {
    return access.error === "Order tidak ditemukan"
      ? jsonError(access.error, 404)
      : jsonForbidden();
  }

  let imageUrl: string | undefined;
  if (parsed.data.image) {
    const saved = await saveChatImage(parsed.data.image);
    if (!saved.ok) return jsonError(saved.error, 422);
    imageUrl = saved.url;
  }

  const textBody = parsed.data.body?.trim() || (imageUrl ? "" : "");

  const msg = await prisma.orderMessage.create({
    data: {
      orderId: parsed.data.orderId,
      senderId: auth.user.id,
      body: textBody,
      imageUrl: imageUrl || null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  const preview = imageUrl
    ? textBody
      ? `📷 ${textBody.slice(0, 60)}`
      : "📷 Foto"
    : textBody.slice(0, 80);

  try {
    if (auth.user.role === "customer") {
      const admins = await prisma.user.findMany({
        where: { role: "admin", status: "active" },
        select: { id: true },
        take: 5,
      });
      await Promise.all(
        admins.map((a) =>
          createNotification({
            userId: a.id,
            orderId: access.order.id,
            title: "Pesan customer",
            message: `${access.order.customer.name} (${access.order.orderNumber}): ${preview}`,
          })
        )
      );
    } else {
      await createNotification({
        userId: access.order.customerId,
        orderId: access.order.id,
        title: "Balasan outlet",
        message: `Outlet membalas (${access.order.orderNumber}): ${preview}`,
      });
    }
  } catch (e) {
    console.error("[messages] notify failed", e);
  }

  return jsonOk(mapMsg(msg, auth.user.id), 201);
}
