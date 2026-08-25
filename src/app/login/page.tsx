"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { PasswordInput } from "@/components/password-input";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/i18n/context";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("082222222222");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await api<{ role: string }>("/api/auth?action=login", {
      method: "POST",
      body: JSON.stringify({ phone, password, expectedRole: "customer" }),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error || t("common.error"));
      return;
    }
    router.push("/home");
  }

  return (
    <div className="page-bg flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md animate-fade-up p-6 md:p-8">
        <p className="text-sm font-semibold text-primary">{t("auth.customer")}</p>
        <h1 className="mt-1 text-3xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {t("auth.loginSubtitle")}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <Spinner /> : t("common.login")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-semibold text-primary">
            {t("common.register")}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-on-surface-variant">
          {t("common.demo")}: 082222222222 / password123
        </p>
      </div>
    </div>
  );
}
