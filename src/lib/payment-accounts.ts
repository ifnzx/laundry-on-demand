import { prisma } from "@/lib/db";

export type PaymentAccount = {
  id: string;
  /** bank | dana | gopay | ovo | shopeepay | qris | cash | other */
  provider: string;
  label: string;
  accountName: string;
  accountNumber: string;
  notes: string;
  enabled: boolean;
  sortOrder: number;
};

export const PAYMENT_PROVIDERS = [
  { value: "bank", label: "Transfer Bank" },
  { value: "dana", label: "Dana" },
  { value: "gopay", label: "GoPay" },
  { value: "ovo", label: "OVO" },
  { value: "shopeepay", label: "ShopeePay" },
  { value: "qris", label: "QRIS" },
  { value: "cash", label: "Tunai / Cash" },
  { value: "other", label: "Lainnya" },
] as const;

const SETTING_KEY = "payment_accounts";

export function defaultPaymentAccounts(): PaymentAccount[] {
  return [
    {
      id: "bca",
      provider: "bank",
      label: "BCA",
      accountName: "",
      accountNumber: "",
      notes: "Transfer sesuai nominal, cantumkan no. order",
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "dana",
      provider: "dana",
      label: "Dana",
      accountName: "",
      accountNumber: "",
      notes: "",
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "gopay",
      provider: "gopay",
      label: "GoPay",
      accountName: "",
      accountNumber: "",
      notes: "",
      enabled: true,
      sortOrder: 3,
    },
    {
      id: "qris",
      provider: "qris",
      label: "QRIS",
      accountName: "",
      accountNumber: "",
      notes: "Scan QR dari kasir outlet",
      enabled: true,
      sortOrder: 4,
    },
    {
      id: "cash",
      provider: "cash",
      label: "Tunai",
      accountName: "",
      accountNumber: "",
      notes: "Bayar saat jemput atau antar",
      enabled: true,
      sortOrder: 5,
    },
  ];
}

function normalizeAccount(raw: unknown, index: number): PaymentAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const id =
    typeof a.id === "string" && a.id.trim()
      ? a.id.trim()
      : `pay_${index}_${Date.now()}`;
  const label = String(a.label || "").trim();
  if (!label) return null;
  const provider = String(a.provider || "other").trim().toLowerCase();
  return {
    id,
    provider: PAYMENT_PROVIDERS.some((p) => p.value === provider)
      ? provider
      : "other",
    label,
    accountName: String(a.accountName || "").trim(),
    accountNumber: String(a.accountNumber || "").trim(),
    notes: String(a.notes || "").trim(),
    enabled: a.enabled !== false,
    sortOrder:
      typeof a.sortOrder === "number" && Number.isFinite(a.sortOrder)
        ? a.sortOrder
        : index + 1,
  };
}

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return defaultPaymentAccounts();
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return defaultPaymentAccounts();
    const list = parsed
      .map((item, i) => normalizeAccount(item, i))
      .filter((x): x is PaymentAccount => x !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return list.length > 0 ? list : defaultPaymentAccounts();
  } catch {
    return defaultPaymentAccounts();
  }
}

export async function getEnabledPaymentAccounts(): Promise<PaymentAccount[]> {
  return (await getPaymentAccounts()).filter((a) => a.enabled);
}

export async function savePaymentAccounts(
  accounts: PaymentAccount[]
): Promise<PaymentAccount[]> {
  const cleaned = accounts
    .map((item, i) => normalizeAccount(item, i))
    .filter((x): x is PaymentAccount => x !== null)
    .map((a, i) => ({ ...a, sortOrder: i + 1 }));

  if (cleaned.length === 0) {
    throw new Error("Minimal satu metode pembayaran");
  }

  const value = JSON.stringify(cleaned);
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, value },
  });
  return cleaned;
}

export function paymentAccountIcon(provider: string): string {
  switch (provider) {
    case "bank":
      return "account_balance";
    case "qris":
      return "qr_code_2";
    case "cash":
      return "payments";
    case "dana":
    case "gopay":
    case "ovo":
    case "shopeepay":
      return "account_balance_wallet";
    default:
      return "credit_card";
  }
}

/** Map UI account to payment.paymentMethod storage */
export function toPaymentMethodCode(account: PaymentAccount): string {
  if (account.provider === "bank") return "bank_transfer";
  if (account.provider === "cash") return "cash";
  if (account.provider === "qris") return "qris";
  if (
    ["dana", "gopay", "ovo", "shopeepay"].includes(account.provider)
  ) {
    return account.provider;
  }
  return "ewallet";
}
