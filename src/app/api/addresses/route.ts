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

const addressSchema = z.object({
  label: z.string().min(1),
  recipientName: z.string().min(2),
  phone: z.string().min(10),
  address: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  const auth = requireRole(session, ["customer", "admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const addresses = await prisma.address.findMany({
    where: { userId: auth.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return jsonOk(addresses);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer"]);
  if (!auth.ok) {
    if (auth.status === 401) return jsonUnauthorized();
    return jsonForbidden(
      session
        ? "Hanya akun pelanggan yang bisa menambah alamat. Logout admin dulu, lalu login sebagai customer."
        : "Forbidden"
    );
  }

  const body = await req.json();
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidation("Data tidak valid", parsed.error.flatten());
  }

  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: auth.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      ...parsed.data,
      userId: auth.user.id,
    },
  });
  return jsonOk(address, 201);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const existing = await prisma.address.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!existing) return jsonError("Alamat tidak ditemukan", 404);

  const parsed = addressSchema.partial().safeParse(rest);
  if (!parsed.success) {
    return jsonValidation("Data tidak valid", parsed.error.flatten());
  }

  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: auth.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id },
    data: parsed.data,
  });
  return jsonOk(address);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("ID required");

  const existing = await prisma.address.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!existing) return jsonError("Alamat tidak ditemukan", 404);

  await prisma.address.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
