"use client";

import { useI18n } from "@/i18n/context";
import { LOCALES, type Locale } from "@/i18n/types";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "light" | "compact" | "dark";
}) {
  const { locale, setLocale, t } = useI18n();

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest text-xs font-semibold",
          className
        )}
        role="group"
        aria-label={t("common.language")}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            className={cn(
              "px-2.5 py-1 transition-colors",
              locale === l.code
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "light") {
    return (
      <div
        className={cn(
          "inline-flex overflow-hidden rounded-full border border-white/30 bg-white/10 text-xs font-semibold text-white backdrop-blur",
          className
        )}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code as Locale)}
            className={cn(
              "px-2.5 py-1 transition-colors",
              locale === l.code ? "bg-white text-primary" : "hover:bg-white/10"
            )}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div
        className={cn(
          "inline-flex overflow-hidden rounded-lg border border-white/15 bg-white/5 text-xs font-semibold text-white",
          className
        )}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            className={cn(
              "px-2.5 py-1.5 transition-colors",
              locale === l.code ? "bg-primary text-white" : "text-white/70 hover:bg-white/10"
            )}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <label className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-on-surface-variant">{t("common.language")}</span>
      <select
        className="input py-2"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
