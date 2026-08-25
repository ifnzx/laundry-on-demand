"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";

/** Landing is partly server-rendered; wrap content in client child */
export function LandingContent() {
  const { t } = useI18n();

  return (
    <div className="page-bg relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage: `
            linear-gradient(160deg, rgba(0,74,198,0.75) 0%, rgba(37,99,235,0.55) 45%, rgba(250,248,255,0.25) 100%),
            radial-gradient(circle at 100% 0%, rgba(255,255,255,0.2), transparent 50%)
          `,
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-6 pb-10 pt-8">
        <nav className="animate-fade-up flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90">
            {t("common.appName")}
          </span>
          <Link
            href="/login"
            className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur"
          >
            {t("landing.login")}
          </Link>
        </nav>

        <div className="mt-auto flex flex-1 flex-col justify-end pb-6 pt-24">
          <p className="animate-fade-up text-5xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-sm md:text-6xl">
            CleanStream
            <br />
            Laundry
          </p>
          <p className="animate-fade-up animate-delay-1 mt-4 max-w-sm text-base leading-relaxed text-white/85">
            {t("landing.tagline")}
          </p>

          <div className="animate-fade-up animate-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="btn btn-primary w-full px-6 py-3.5 text-base shadow-lg sm:w-auto"
            >
              {t("landing.cta")}
            </Link>
            <Link
              href="/login"
              className="btn w-full border border-white/30 bg-white/10 px-6 py-3.5 text-base text-white backdrop-blur sm:w-auto"
            >
              {t("landing.hasAccount")}
            </Link>
          </div>

          <div className="animate-fade-up animate-delay-3 mt-10 text-xs text-white/70">
            <Link
              href="/admin/login"
              className="underline-offset-2 hover:underline"
            >
              {t("landing.adminPortal")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
