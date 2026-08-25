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
import { calculateOrderPricing } from "@/lib/pricing";
import { assertBillingAllowed } from "@/lib/platform-billing";

const quoteSchema = z.object({
  serviceId: z.string().min(1),
  addressId: z.string().min(1),
  promoCode: z.string().optional(),
  itemQty: z.number().int().min(1).max(50).optional(),
});

/**
 * Calculate price quote — all prices computed server-side
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = requireRole(session, ["customer"]);
  if (!auth.ok) {
    return auth.status === 401 ? jsonUnauthorized() : jsonForbidden();
  }

  const billing = await assertBillingAllowed();
  if (!billing.ok) return jsonError(billing.error, 423);

  const body = await req.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidation("Data tidak valid", parsed.error.flatten());
  }

  // Verify address ownership
  const address = await prisma.address.findFirst({
    where: { id: parsed.data.addressId, userId: auth.user.id },
  });
  if (!address) return jsonError("Alamat tidak valid", 404);

  const result = await calculateOrderPricing(parsed.data);
  if (!result.ok) return jsonError(result.error, 422);

  return jsonOk(result.data);
}
