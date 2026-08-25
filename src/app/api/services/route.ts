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
import { createAuditLog } from "@/lib/notifications";

export async function GET() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";

  const services = await prisma.service.findMany({
    where: isAdmin ? undefined : { status: "active" },
    orderBy: { price: "asc" },
  });
  return jsonOk(services);
}

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  pricingType: z.enum(["per_kg", "per_item", "fixed"]).default("per_kg"),
  estimatedDuration: z.number().int().positive().default(48),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidation("Data tidak valid", parsed.error.flatten());
  }

  const service = await prisma.service.create({ data: parsed.data });
  await createAuditLog({
    userId: auth.user.id,
    action: "create",
    entity: "service",
    entityId: service.id,
    newValue: service,
  });
  return jsonOk(service, 201);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const parsed = serviceSchema.partial().safeParse(rest);
  if (!parsed.success) {
    return jsonValidation("Data tidak valid", parsed.error.flatten());
  }

  const old = await prisma.service.findUnique({ where: { id } });
  const service = await prisma.service.update({
    where: { id },
    data: parsed.data,
  });
  await createAuditLog({
    userId: auth.user.id,
    action: "update",
    entity: "service",
    entityId: id,
    oldValue: old,
    newValue: service,
  });
  return jsonOk(service);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("ID required");

  // Soft delete
  const service = await prisma.service.update({
    where: { id },
    data: { status: "inactive" },
  });
  await createAuditLog({
    userId: auth.user.id,
    action: "deactivate",
    entity: "service",
    entityId: id,
  });
  return jsonOk(service);
}
