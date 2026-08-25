import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createToken,
  hashPassword,
  setAuthCookie,
  verifyPassword,
  getSession,
  clearAuthCookie,
} from "@/lib/auth";
import { jsonError, jsonOk, jsonUnauthorized, jsonValidation } from "@/lib/api";

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
});

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "login";

  try {
    const body = await req.json();

    if (action === "register") {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return jsonValidation("Data tidak valid", parsed.error.flatten());
      }
      const { name, phone, email, password } = parsed.data;

      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { phone },
            ...(email ? [{ email }] : []),
          ],
        },
      });
      if (existing) {
        return jsonError("Nomor telepon atau email sudah terdaftar", 409);
      }

      const hashed = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name,
          phone,
          email: email || null,
          password: hashed,
          role: "customer",
        },
      });

      const token = await createToken({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: "customer",
        photo: user.photo,
      });
      await setAuthCookie(token);

      return jsonOk(
        {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
        201
      );
    }

    if (action === "login") {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        return jsonValidation("Data tidak valid", parsed.error.flatten());
      }

      const user = await prisma.user.findUnique({
        where: { phone: parsed.data.phone },
      });
      if (!user) return jsonError("Nomor telepon atau password salah", 401);
      if (user.status === "suspended") {
        return jsonError("Akun Anda ditangguhkan", 403);
      }

      const valid = await verifyPassword(parsed.data.password, user.password);
      if (!valid) return jsonError("Nomor telepon atau password salah", 401);

      // Optional role restriction for portal logins
      if (body.expectedRole && user.role !== body.expectedRole) {
        return jsonError("Akses ditolak untuk portal ini", 403);
      }

      const token = await createToken({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role as "customer" | "courier" | "admin",
        photo: user.photo,
      });
      await setAuthCookie(token);

      return jsonOk({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        photo: user.photo,
      });
    }

    if (action === "logout") {
      await clearAuthCookie();
      return jsonOk({ message: "Logged out" });
    }

    return jsonError("Unknown action", 400);
  } catch (e) {
    console.error(e);
    return jsonError("Server error", 500);
  }
}

export async function GET() {
  const user = await getSession();
  if (!user) return jsonUnauthorized();

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      photo: true,
      role: true,
      vehicle: true,
      isOnline: true,
      rating: true,
      status: true,
      createdAt: true,
    },
  });
  if (!full) return jsonUnauthorized();
  return jsonOk(full);
}
