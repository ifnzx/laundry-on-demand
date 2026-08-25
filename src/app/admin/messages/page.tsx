"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { OrderChat } from "@/components/order-chat";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";

type InboxItem = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  lastBody: string;
  lastAt: string;
  lastSenderRole: string;
  unread: number;
};

function AdminMessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("orderId") || "";
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadInbox() {
    const res = await api<InboxItem[]>("/api/messages?inbox=true");
    setItems(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      await loadInbox();
    })();
  }, [router]);

  useEffect(() => {
    const t = setInterval(loadInbox, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Pesan</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        Percakapan per order
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">Inbox</p>
          </div>
          {loading ? (
            <LoadingBlock />
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-[var(--fg-muted)]">
              Belum ada pesan
            </p>
          ) : (
            <ul className="max-h-[min(70vh,560px)] divide-y divide-[var(--border)] overflow-y-auto">
              {items.map((item) => {
                const active = item.orderId === selected;
                return (
                  <li key={item.orderId}>
                    <Link
                      href={`/admin/messages?orderId=${item.orderId}`}
                      className={`block px-4 py-3 transition ${
                        active
                          ? "bg-primary/10"
                          : "hover:bg-[var(--surface-container-low)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {item.customerName}
                          </p>
                          <p className="font-mono text-xs text-[var(--brand)]">
                            {item.orderNumber}
                          </p>
                        </div>
                        {item.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {item.unread}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-[var(--fg-muted)]">
                        {item.lastSenderRole === "admin" ? "Anda: " : ""}
                        {item.lastBody}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
                        {formatDateTime(item.lastAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <OrderChat
              orderId={selected}
              role="admin"
              className="h-[min(70vh,560px)] overflow-hidden rounded-2xl border border-[var(--border)]"
            />
          ) : (
            <div className="card flex h-[min(70vh,560px)] flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-[var(--fg-muted)]" />
              <p className="font-semibold">Pilih chat</p>
              <p className="mt-1 max-w-xs text-sm text-[var(--fg-muted)]">
                Pilih order di kiri
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminMessagesPage() {
  return (
    <AdminShell>
      <Suspense fallback={<LoadingBlock />}>
        <AdminMessagesInner />
      </Suspense>
    </AdminShell>
  );
}
