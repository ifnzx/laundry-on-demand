import { getSession, requireRole, hashPassword } from "@/lib/auth";
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonValidation } from "@/lib/api";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const body = await req.json();

  if (body.action === "update_profile") {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional().or(z.literal("")),
      photo: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation("Data tidak valid", parsed.error.flatten());
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email || undefined,
        photo: parsed.data.photo,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        photo: true,
        role: true,
      },
    });
    return jsonOk(user);
  }

  if (body.action === "change_password") {
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return jsonError("Password baru minimal 6 karakter");
    }
    const { verifyPassword } = await import("@/lib/auth");
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return jsonUnauthorized();
    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) return jsonError("Password saat ini salah");
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: session.id },
      data: { password: hashed },
    });
    return jsonOk({ message: "Password diperbarui" });
  }

  return jsonError("Unknown action");
}

export async function GET() {
  const session = await getSession();
  const auth = requireRole(session, ["customer", "courier", "admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const promos = await prisma.promo.findMany({
    where: {
      status: "active",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(promos);
}
