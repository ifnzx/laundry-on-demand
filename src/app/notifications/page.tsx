"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import {
  useNotifications,
} from "@/components/notification-context";
import { EmptyState, LoadingBlock, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { cn, formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/context";

export default function NotificationsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      setAuthed(true);
    })();
  }, [router]);

  return (
    <CustomerShell>
      {!authed ? <LoadingBlock /> : <NotificationsList />}
    </CustomerShell>
  );
}

function NotificationsList() {
  const router = useRouter();
  const { t } = useI18n();
  const { items, unread, loading, markRead, markAllRead } = useNotifications();
  const [marking, setMarking] = useState(false);

  async function onMarkAll() {
    setMarking(true);
    await markAllRead();
    setMarking(false);
  }

  async function openItem(n: (typeof items)[0]) {
    if (!n.isRead) {
      await markRead(n.id);
    }
    if (n.orderId || n.order?.id) {
      router.push(`/orders/${n.orderId || n.order?.id}`);
    }
  }

  if (loading && items.length === 0) {
    return <LoadingBlock />;
  }

  return (
    <div className="px-4 pb-10 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("notif.title")}
          </h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {t("notif.subtitle")}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={marking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {marking ? (
              <Spinner />
            ) : (
              <>
                <CheckCheck className="h-3.5 w-3.5" />
                {t("notif.markAll")}
              </>
            )}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("notif.empty")}
            description={t("notif.emptyHint")}
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((n) => {
            const hasOrder = !!(n.orderId || n.order?.id);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99]",
                    n.isRead
                      ? "border-outline-variant/40 bg-surface-container-lowest"
                      : "border-primary/20 bg-primary/[0.06]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      n.isRead
                        ? "bg-surface-container text-on-surface-variant"
                        : "bg-primary/15 text-primary"
                    )}
                  >
                    <Bell className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          n.isRead
                            ? "font-medium text-on-surface"
                            : "font-semibold text-on-surface"
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-on-surface-variant">
                      {n.message}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-on-surface-variant">
                      <span>{formatDateTime(n.createdAt)}</span>
                      {n.order?.orderNumber && (
                        <span className="font-mono font-medium text-primary">
                          {n.order.orderNumber}
                        </span>
                      )}
                    </span>
                  </span>
                  {hasOrder && (
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-on-surface-variant" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-on-surface-variant">
        <Link href="/orders" className="font-medium text-primary">
          {t("notif.viewOrders")}
        </Link>
      </p>
    </div>
  );
}
