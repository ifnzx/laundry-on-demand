export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "waiting_courier",
  "courier_assigned",
  "courier_to_customer",
  "picked_up",
  "received_at_outlet",
  "weighing",
  "waiting_additional_payment",
  "washing",
  "drying",
  "ironing",
  "packing",
  "ready_for_delivery",
  "courier_to_customer_delivery",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Unified ops model: Admin = outlet + pickup + delivery.
 * courier_* statuses tetap dipakai sebagai status operasional internal.
 */
export const STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["waiting_courier", "cancelled"],
  // Admin langsung bisa jemput tanpa assign kurir terpisah
  waiting_courier: [
    "courier_to_customer",
    "courier_assigned",
    "picked_up",
    "cancelled",
  ],
  courier_assigned: ["courier_to_customer", "picked_up", "waiting_courier", "cancelled"],
  courier_to_customer: ["picked_up", "cancelled"],
  picked_up: ["received_at_outlet"],
  received_at_outlet: ["weighing"],
  weighing: ["waiting_additional_payment", "washing"],
  waiting_additional_payment: ["washing", "cancelled"],
  washing: ["drying"],
  drying: ["ironing"],
  ironing: ["packing"],
  packing: ["ready_for_delivery"],
  ready_for_delivery: ["courier_to_customer_delivery", "delivered"],
  courier_to_customer_delivery: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

export const LAUNDRY_KANBAN_COLUMNS = [
  { key: "received_at_outlet", label: "Received" },
  { key: "weighing", label: "Weighing" },
  { key: "waiting_additional_payment", label: "Add. Pay" },
  { key: "washing", label: "Washing" },
  { key: "drying", label: "Drying" },
  { key: "ironing", label: "Ironing" },
  { key: "packing", label: "Packing" },
  { key: "ready_for_delivery", label: "Ready" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Menunggu Pembayaran",
  paid: "Sudah Dibayar",
  waiting_courier: "Menunggu Jemput",
  courier_assigned: "Siap Diambil Tim",
  courier_to_customer: "Tim Menuju Lokasi",
  picked_up: "Laundry Diambil",
  received_at_outlet: "Diterima di Outlet",
  weighing: "Penimbangan",
  waiting_additional_payment: "Menunggu Pembayaran Tambahan",
  washing: "Sedang Dicuci",
  drying: "Sedang Dijemur",
  ironing: "Sedang Disetrika",
  packing: "Sedang Dikemas",
  ready_for_delivery: "Siap Diantar",
  courier_to_customer_delivery: "Tim Sedang Mengantar",
  delivered: "Sudah Diterima",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  waiting_courier: "bg-blue-100 text-blue-800",
  courier_assigned: "bg-blue-100 text-blue-800",
  courier_to_customer: "bg-indigo-100 text-indigo-800",
  picked_up: "bg-violet-100 text-violet-800",
  received_at_outlet: "bg-cyan-100 text-cyan-800",
  weighing: "bg-cyan-100 text-cyan-800",
  waiting_additional_payment: "bg-orange-100 text-orange-800",
  washing: "bg-sky-100 text-sky-800",
  drying: "bg-sky-100 text-sky-800",
  ironing: "bg-sky-100 text-sky-800",
  packing: "bg-sky-100 text-sky-800",
  ready_for_delivery: "bg-teal-100 text-teal-800",
  courier_to_customer_delivery: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function canTransition(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to as OrderStatus);
}

/** Status yang butuh aksi jemput oleh admin/outlet */
export const PICKUP_QUEUE_STATUSES = [
  "waiting_courier",
  "courier_assigned",
  "courier_to_customer",
] as const;

/** Status yang butuh aksi antar */
export const DELIVERY_QUEUE_STATUSES = [
  "ready_for_delivery",
  "courier_to_customer_delivery",
] as const;
