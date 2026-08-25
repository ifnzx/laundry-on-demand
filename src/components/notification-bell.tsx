"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  useNotificationsOptional,
} from "@/components/notification-context";
import { cn } from "@/lib/utils";

/** Bell with unread badge — shares live poll with home “Update terbaru” */
export function NotificationBell({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const ctx = useNotificationsOptional();
  const unread = ctx?.unread ?? 0;

  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant/40 transition active:scale-95",
        box,
        className
      )}
      aria-label={
        unread > 0
          ? `Notifikasi, ${unread} belum dibaca`
          : "Notifikasi"
      }
    >
      <Bell className={icon} strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
