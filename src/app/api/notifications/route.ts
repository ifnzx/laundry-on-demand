import { NextRequest } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { jsonForbidden, jsonOk, jsonUnauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const countOnly = searchParams.get("count") === "true";

  if (countOnly) {
    const unread = await prisma.notification.count({
      where: { userId: session.id, isRead: false },
    });
    return jsonOk({ unread });
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    include: {
      order: { select: { id: true, orderNumber: true, orderStatus: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk(notifications);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer", "courier", "admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  if (body.action === "read_all") {
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, isRead: false },
      data: { isRead: true },
    });
    return jsonOk({ read: true });
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: auth.user.id },
      data: { isRead: true },
    });
    return jsonOk({ read: true });
  }

  return jsonOk({ ok: true });
}
