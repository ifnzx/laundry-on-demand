import { prisma } from "@/lib/db";

export const DEFAULT_PLATFORM_FEE = 1500;

export type BillingSummary = {
  locked: boolean;
  feePerOrder: number;
  currentYearMonth: string;
  unpaidTotal: number;
  unpaidInvoices: {
    id: string;
    yearMonth: string;
    totalAmount: number;
    feeCount: number;
    status: string;
    dueAt: string;
  }[];
  invoices: {
    id: string;
    yearMonth: string;
    totalAmount: number;
    feeCount: number;
    status: string;
    dueAt: string;
    paidAt: string | null;
    paidNote: string | null;
  }[];
  currentMonth: {
    yearMonth: string;
    totalAmount: number;
    feeCount: number;
    status: string;
  } | null;
  lockReason: string | null;
};

/** Format date as YYYY-MM in local timezone */
export function toYearMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Last moment of a calendar month (local) — due date for that invoice month */
export function monthEndDueAt(yearMonth: string): Date {
  const [y, m] = yearMonth.split("-").map(Number);
  // day 0 of next month = last day of this month, 23:59:59.999
  return new Date(y, m, 0, 23, 59, 59, 999);
}

export async function getPlatformFeePerOrder(): Promise<number> {
  // Fee ditentukan developer/platform (env), bukan admin outlet
  const fromEnv = parseFloat(process.env.PLATFORM_FEE_PER_ORDER || "");
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
  return DEFAULT_PLATFORM_FEE;
}

/**
 * Ensure invoice for yearMonth exists. Recalc totals from entries.
 */
export async function ensureInvoice(yearMonth: string) {
  const dueAt = monthEndDueAt(yearMonth);
  const invoice = await prisma.platformInvoice.upsert({
    where: { yearMonth },
    create: {
      yearMonth,
      totalAmount: 0,
      feeCount: 0,
      status: "open",
      dueAt,
    },
    update: {},
  });
  return invoice;
}

async function recomputeInvoiceTotals(invoiceId: string) {
  const agg = await prisma.platformFeeEntry.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
    _count: true,
  });
  return prisma.platformInvoice.update({
    where: { id: invoiceId },
    data: {
      totalAmount: agg._sum.amount || 0,
      feeCount: agg._count,
    },
  });
}

/**
 * Close past months that are still open after their due date → due (unlocks payment expectation).
 * Call on billing reads and before lock checks.
 */
export async function syncBillingState(now = new Date()) {
  const current = toYearMonth(now);

  await ensureInvoice(current);

  // Any open invoice from a previous month past due → mark due (unpaid)
  const openPast = await prisma.platformInvoice.findMany({
    where: {
      status: "open",
      yearMonth: { lt: current },
    },
  });

  for (const inv of openPast) {
    if (now.getTime() > inv.dueAt.getTime()) {
      // Zero-amount periods auto-close as paid (nothing to collect)
      if (inv.totalAmount <= 0) {
        await prisma.platformInvoice.update({
          where: { id: inv.id },
          data: { status: "paid", paidAt: now, paidNote: "Tanpa transaksi" },
        });
      } else {
        await prisma.platformInvoice.update({
          where: { id: inv.id },
          data: { status: "due" },
        });
      }
    }
  }

  // Reconcile: entries without matching invoice totals
  const dueWithZero = await prisma.platformInvoice.findMany({
    where: { status: "due", totalAmount: 0 },
  });
  for (const inv of dueWithZero) {
    await prisma.platformInvoice.update({
      where: { id: inv.id },
      data: { status: "paid", paidAt: now, paidNote: "Tanpa transaksi" },
    });
  }
}

/**
 * System is locked if any previous-month invoice is still unpaid (due/overdue).
 * Current open month stays usable until its due date passes.
 */
export async function isBillingLocked(now = new Date()): Promise<{
  locked: boolean;
  reason: string | null;
  unpaidTotal: number;
}> {
  await syncBillingState(now);

  const unpaid = await prisma.platformInvoice.findMany({
    where: {
      status: { in: ["due", "overdue"] },
      totalAmount: { gt: 0 },
    },
    orderBy: { yearMonth: "asc" },
  });

  if (unpaid.length === 0) {
    return { locked: false, reason: null, unpaidTotal: 0 };
  }

  const unpaidTotal = unpaid.reduce((s, i) => s + i.totalAmount, 0);
  const months = unpaid.map((i) => i.yearMonth).join(", ");
  return {
    locked: true,
    reason: `Tagihan platform belum dibayar (periode ${months}). Bayar total Rp ${Math.round(unpaidTotal).toLocaleString("id-ID")} untuk membuka kembali sistem.`,
    unpaidTotal,
  };
}

export async function assertBillingAllowed(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const state = await isBillingLocked();
  if (state.locked) {
    return {
      ok: false,
      error:
        state.reason ||
        "Sistem dikunci karena tagihan fee platform belum dibayar.",
    };
  }
  return { ok: true };
}

/**
 * Accrue 1× platform fee for a billable order. Idempotent per orderId.
 * Dipanggil saat pembayaran pertama berhasil, dan fallback saat order completed.
 */
export async function accrueFeeForOrder(orderId: string, at = new Date()) {
  const existing = await prisma.platformFeeEntry.findUnique({
    where: { orderId },
  });
  if (existing) return existing;

  const fee = await getPlatformFeePerOrder();
  if (fee <= 0) return null;

  const yearMonth = toYearMonth(at);
  const invoice = await ensureInvoice(yearMonth);

  try {
    const entry = await prisma.platformFeeEntry.create({
      data: {
        orderId,
        invoiceId: invoice.id,
        amount: fee,
        yearMonth,
      },
    });
    await recomputeInvoiceTotals(invoice.id);
    return entry;
  } catch {
    // Race: unique orderId — refetch
    return prisma.platformFeeEntry.findUnique({ where: { orderId } });
  }
}

/**
 * Backfill fee untuk order yang sudah punya pembayaran sukses / selesai,
 * tapi belum punya entri fee (simulasi lama sebelum aturan baru).
 */
export async function backfillMissingPlatformFees() {
  const feeed = await prisma.platformFeeEntry.findMany({
    select: { orderId: true },
  });
  const feeedIds = new Set(feeed.map((f) => f.orderId));

  const candidates = await prisma.order.findMany({
    where: {
      OR: [
        { paidAmount: { gt: 0 } },
        { orderStatus: "completed" },
        { paymentStatus: { in: ["paid", "partial"] } },
      ],
    },
    select: { id: true, paidAmount: true, completedAt: true, createdAt: true },
  });

  let added = 0;
  for (const o of candidates) {
    if (feeedIds.has(o.id)) continue;
    if (o.paidAmount <= 0 && !o.completedAt) continue;
    const at = o.completedAt || o.createdAt;
    const row = await accrueFeeForOrder(o.id, at);
    if (row) added += 1;
  }
  return added;
}

export async function getBillingSummary(): Promise<BillingSummary> {
  await syncBillingState();
  // Pastikan simulasi order yang sudah dibayar tapi belum di-fee ikut masuk
  await backfillMissingPlatformFees();
  await syncBillingState();
  const feePerOrder = await getPlatformFeePerOrder();
  const currentYearMonth = toYearMonth();
  const lock = await isBillingLocked();

  const invoices = await prisma.platformInvoice.findMany({
    orderBy: { yearMonth: "desc" },
    take: 24,
  });

  const unpaidInvoices = invoices
    .filter((i) => ["due", "overdue"].includes(i.status) && i.totalAmount > 0)
    .map((i) => ({
      id: i.id,
      yearMonth: i.yearMonth,
      totalAmount: i.totalAmount,
      feeCount: i.feeCount,
      status: i.status,
      dueAt: i.dueAt.toISOString(),
    }));

  const current = invoices.find((i) => i.yearMonth === currentYearMonth);

  return {
    locked: lock.locked,
    feePerOrder,
    currentYearMonth,
    unpaidTotal: lock.unpaidTotal,
    unpaidInvoices,
    invoices: invoices.map((i) => ({
      id: i.id,
      yearMonth: i.yearMonth,
      totalAmount: i.totalAmount,
      feeCount: i.feeCount,
      status: i.status,
      dueAt: i.dueAt.toISOString(),
      paidAt: i.paidAt?.toISOString() ?? null,
      paidNote: i.paidNote,
    })),
    currentMonth: current
      ? {
          yearMonth: current.yearMonth,
          totalAmount: current.totalAmount,
          feeCount: current.feeCount,
          status: current.status,
        }
      : null,
    lockReason: lock.reason,
  };
}

export async function markInvoicePaid(params: {
  invoiceId: string;
  note?: string;
  userId?: string;
}) {
  const inv = await prisma.platformInvoice.findUnique({
    where: { id: params.invoiceId },
  });
  if (!inv) return { ok: false as const, error: "Invoice tidak ditemukan" };
  if (inv.status === "paid") {
    return { ok: true as const, data: inv };
  }

  const updated = await prisma.platformInvoice.update({
    where: { id: params.invoiceId },
    data: {
      status: "paid",
      paidAt: new Date(),
      paidNote: params.note || "Dibayar",
    },
  });

  return { ok: true as const, data: updated };
}
