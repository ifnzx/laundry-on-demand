"use client";

import { formatRupiah } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { ts } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap",
        "rounded-md px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-wide",
        STATUS_COLORS[status] || "bg-gray-100 text-gray-700",
        className
      )}
    >
      {ts(status)}
    </span>
  );
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  return <span className={className}>{formatRupiah(amount)}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white",
        className
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-soft)] text-3xl">
        🧺
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-sm text-[var(--fg-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)]" />
      <p className="text-sm text-[var(--fg-muted)]">
        {label || t("common.loading")}
      </p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
