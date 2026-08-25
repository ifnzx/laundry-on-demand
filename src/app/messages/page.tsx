"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/order-status";
import { useI18n } from "@/i18n/context";

type InboxItem = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  outletName?: string | null;
  lastBody: string;
  lastAt: string;
  lastSenderRole: string;
  unread: number;
};

export default function CustomerMessagesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api<InboxItem[]>("/api/messages?inbox=true");
    setItems(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      await load();
    })();
  }, [router, load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <CustomerShell>
      <header className="px-4 pb-2 pt-5">
        <h1 className="text-xl font-semibold tracking-tight text-on-surface">
          {t("nav.chat")}
        </h1>
      </header>

      <main className="px-4 pb-6">
        {loading ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare
              className="mb-3 h-10 w-10 text-on-surface-variant"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-on-surface">Belum ada chat</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Chat muncul setelah ada pesan di pesanan
            </p>
            <Link
              href="/orders"
              className="mt-4 text-sm font-semibold text-primary"
            >
              Lihat pesanan
            </Link>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
            {items.map((item, i) => (
              <li key={item.orderId}>
                <Link
                  href={`/orders/${item.orderId}/chat`}
                  className={`flex items-start gap-3 px-4 py-3.5 transition hover:bg-surface-container/80 active:bg-surface-container ${
                    i > 0 ? "border-t border-outline-variant/40" : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">
                          {item.outletName || "Outlet"}
                        </p>
                        <p className="font-mono text-[11px] text-primary">
                          {item.orderNumber}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] text-on-surface-variant">
                          {formatDateTime(item.lastAt)}
                        </span>
                        {item.unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-on-primary">
                            {item.unread > 9 ? "9+" : item.unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">
                      {item.lastSenderRole === "customer" ? "Anda: " : ""}
                      {item.lastBody || "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">
                      {STATUS_LABELS[item.orderStatus] || item.orderStatus}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </CustomerShell>
  );
}
