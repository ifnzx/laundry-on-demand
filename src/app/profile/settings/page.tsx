"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { LoadingBlock, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

type User = { name: string; phone: string; email?: string | null };

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const me = await api<User>("/api/auth");
      if (!me.success || !me.data) {
        router.push("/login");
        return;
      }
      setForm({ name: me.data.name, email: me.data.email || "" });
      setLoading(false);
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ action: "update_profile", ...form }),
    });
    setSaving(false);
    setMsg(res.success ? t("profile.updated") : res.error || t("common.error"));
  }

  if (loading) {
    return (
      <CustomerShell hideNav>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell hideNav>
      <div className="px-4 pt-6 pb-10">
        <Link href="/profile" className="text-sm text-primary">
          ← {t("profile.title")}
        </Link>
        <PageHeader title={t("profile.settings")} subtitle={t("profile.edit")} />

        <div className="card mb-4 space-y-3 p-4">
          <p className="text-sm font-semibold text-on-surface">
            {t("common.language")}
          </p>
          <p className="text-xs text-on-surface-variant">
            {t("profile.languageHint")}
          </p>
          <LanguageSwitcher />
        </div>

        <form onSubmit={save} className="card space-y-4 p-4">
          <div>
            <label className="label">{t("common.name")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">{t("common.email")}</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {msg && <p className="text-sm text-primary">{msg}</p>}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={saving}
          >
            {saving ? <Spinner /> : t("common.save")}
          </button>
        </form>
      </div>
    </CustomerShell>
  );
}
