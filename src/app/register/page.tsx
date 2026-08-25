"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { PasswordInput } from "@/components/password-input";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/i18n/context";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await api("/api/auth?action=register", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error || t("common.error"));
      return;
    }
    router.push("/home");
  }

  return (
    <div className="page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md animate-fade-up p-6 md:p-8">
        <p className="text-sm font-semibold text-primary">{t("auth.customer")}</p>
        <h1 className="mt-1 text-3xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {t("auth.registerSubtitle")}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t("auth.fullName")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
          <div>
            <label className="label">
              {t("common.email")} ({t("common.optional")})
            </label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <PasswordInput
              value={form.password}
              onChange={(password) => setForm({ ...form, password })}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <Spinner /> : t("auth.registerNow")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="font-semibold text-primary">
            {t("common.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
