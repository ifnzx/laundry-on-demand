"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { PasswordInput } from "@/components/password-input";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/i18n/context";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("081111111111");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await api("/api/auth?action=login", {
      method: "POST",
      body: JSON.stringify({ phone, password, expectedRole: "admin" }),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error || t("common.error"));
      return;
    }
    router.push("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1f24] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-primary">{t("auth.adminPortal")}</p>
        <h1 className="mt-1 text-3xl font-semibold">{t("auth.adminTitle")}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? <Spinner /> : t("common.login")}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-on-surface-variant">
          {t("common.demo")}: 081111111111 / password123
        </p>
      </div>
    </div>
  );
}
