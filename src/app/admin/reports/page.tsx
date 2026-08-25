"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";

export default function AdminReportsRealPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    orders: {
      createdAt: string;
      total: number;
      paidAmount: number;
      orderStatus: string;
      paymentStatus: string;
    }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      const res = await api<{
        orders: {
          createdAt: string;
          total: number;
          paidAmount: number;
          orderStatus: string;
          paymentStatus: string;
        }[];
      }>("/api/admin?resource=reports");
      setData(res.data || null);
    })();
  }, [router]);

  if (!data) {
    return (
      <AdminShell>
        <LoadingBlock />
      </AdminShell>
    );
  }

  const totalOrders = data.orders.length;
  const revenue = data.orders.reduce((s, o) => s + o.paidAmount, 0);
  const completed = data.orders.filter((o) => o.orderStatus === "completed").length;
  const cancelled = data.orders.filter((o) => o.orderStatus === "cancelled").length;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">30 hari terakhir</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Orders</p>
          <p className="mt-2 text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Revenue</p>
          <p className="mt-2 text-2xl font-bold">
            <Money amount={revenue} />
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Completed</p>
          <p className="mt-2 text-2xl font-bold">{completed}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-[var(--fg-muted)]">Cancelled</p>
          <p className="mt-2 text-2xl font-bold">{cancelled}</p>
        </div>
      </div>
    </AdminShell>
  );
}
