"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Money } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
};

export default function AdminCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      const res = await api<Customer[]>("/api/admin?resource=customers");
      setCustomers(res.data || []);
      setLoading(false);
    })();
  }, [router]);

  async function suspend(id: string, status: string) {
    await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "update_customer_status",
        id,
        status: status === "active" ? "suspended" : "active",
      }),
    });
    const res = await api<Customer[]>("/api/admin?resource=customers");
    setCustomers(res.data || []);
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone.includes(q)
  );

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold">Customers</h1>
      <input
        className="input mt-4 max-w-sm"
        placeholder="Cari customer..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--fg-muted)]">
                <th className="p-3">Nama</th>
                <th className="p-3">Kontak</th>
                <th className="p-3">Orders</th>
                <th className="p-3">Spending</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]/50">
                  <td className="p-3 font-medium">
                    {c.name}
                    <p className="text-xs text-[var(--fg-muted)]">{formatDate(c.createdAt)}</p>
                  </td>
                  <td className="p-3">
                    {c.phone}
                    <br />
                    <span className="text-xs text-[var(--fg-muted)]">{c.email}</span>
                  </td>
                  <td className="p-3">{c.orderCount}</td>
                  <td className="p-3"><Money amount={c.totalSpent} /></td>
                  <td className="p-3 capitalize">{c.status}</td>
                  <td className="p-3">
                    <button className="btn btn-secondary text-xs" onClick={() => suspend(c.id, c.status)}>
                      {c.status === "active" ? "Suspend" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
