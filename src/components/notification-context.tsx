"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/client-api";

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  orderId?: string | null;
  order?: {
    id: string;
    orderNumber: string;
    orderStatus: string;
  } | null;
};

type Ctx = {
  items: CustomerNotification[];
  unread: number;
  latest: CustomerNotification[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<Ctx | null>(null);

const POLL_MS = 4000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await api<CustomerNotification[]>("/api/notifications");
      if (res.success && res.data) {
        setItems(res.data);
      }
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      void refresh();
    };

    const start = () => {
      tick();
      if (timer) clearInterval(timer);
      timer = setInterval(tick, POLL_MS);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (typeof document !== "undefined" && document.hidden) {
      // still fetch once when mounting background tab
      tick();
    } else {
      start();
    }

    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    const onFocus = () => {
      void refresh();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic UI
      setItems((list) =>
        list.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      await api("/api/notifications", {
        method: "PUT",
        body: JSON.stringify({ id }),
      });
      await refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    await api("/api/notifications", {
      method: "PUT",
      body: JSON.stringify({ action: "read_all" }),
    });
    await refresh();
  }, [refresh]);

  const unread = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items]
  );

  const latest = useMemo(() => items.slice(0, 2), [items]);

  const value = useMemo(
    () => ({
      items,
      unread,
      latest,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, unread, latest, loading, refresh, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}

/** Safe when provider missing (e.g. admin pages) — returns null context flags */
export function useNotificationsOptional() {
  return useContext(NotificationContext);
}
