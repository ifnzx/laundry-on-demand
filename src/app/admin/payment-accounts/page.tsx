"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { LoadingBlock, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { PAYMENT_PROVIDERS } from "@/lib/payment-accounts";

type Account = {
  id: string;
  provider: string;
  label: string;
  accountName: string;
  accountNumber: string;
  notes: string;
  enabled: boolean;
  sortOrder: number;
};

function emptyAccount(): Account {
  return {
    id: `new_${Date.now()}`,
    provider: "bank",
    label: "",
    accountName: "",
    accountNumber: "",
    notes: "",
    enabled: true,
    sortOrder: 99,
  };
}

export default function AdminPaymentAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await api<Account[]>("/api/admin?resource=payment_accounts");
    setAccounts(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const me = await api<{ role: string }>("/api/auth");
      if (!me.success || me.data?.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      await load();
    })();
  }, [router]);

  function update(id: string, patch: Partial<Account>) {
    setAccounts((list) =>
      list.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }

  function remove(id: string) {
    setAccounts((list) => list.filter((a) => a.id !== id));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMsg("");
    const res = await api<Account[]>("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "update_payment_accounts",
        accounts: accounts.map((a, i) => ({
          ...a,
          sortOrder: i + 1,
        })),
      }),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setAccounts(res.data || accounts);
    setMsg("Rekening & e-wallet tersimpan");
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Rekening & e-wallet
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Atur nomor rekening, Dana, GoPay, dan metode bayar yang dilihat
            customer
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={() => setAccounts((list) => [...list, emptyAccount()])}
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => void save()}
            disabled={saving || accounts.length === 0}
          >
            {saving ? <Spinner /> : "Simpan"}
          </button>
        </div>
      </div>

      {msg && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <ul className="mt-6 space-y-4">
          {accounts.map((a, index) => (
            <li
              key={a.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--fg)]">
                  Metode #{index + 1}
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <input
                      type="checkbox"
                      checked={a.enabled}
                      onChange={(e) =>
                        update(a.id, { enabled: e.target.checked })
                      }
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Hapus"
                    disabled={accounts.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Jenis</label>
                  <select
                    className="input"
                    value={a.provider}
                    onChange={(e) => {
                      const provider = e.target.value;
                      const preset = PAYMENT_PROVIDERS.find(
                        (p) => p.value === provider
                      );
                      update(a.id, {
                        provider,
                        label:
                          a.label ||
                          (provider === "bank"
                            ? "BCA"
                            : preset?.label || a.label),
                      });
                    }}
                  >
                    {PAYMENT_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Nama tampilan</label>
                  <input
                    className="input"
                    placeholder="BCA / Dana / GoPay"
                    value={a.label}
                    onChange={(e) => update(a.id, { label: e.target.value })}
                  />
                </div>
                {a.provider !== "cash" && a.provider !== "qris" && (
                  <>
                    <div>
                      <label className="label">
                        {a.provider === "bank"
                          ? "Atas nama rekening"
                          : "Nama akun"}
                      </label>
                      <input
                        className="input"
                        placeholder="Nama pemilik"
                        value={a.accountName}
                        onChange={(e) =>
                          update(a.id, { accountName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">
                        {a.provider === "bank"
                          ? "No. rekening"
                          : "No. HP / ID"}
                      </label>
                      <input
                        className="input font-mono"
                        placeholder={
                          a.provider === "bank"
                            ? "1234567890"
                            : "08xxxxxxxxxx"
                        }
                        value={a.accountNumber}
                        onChange={(e) =>
                          update(a.id, { accountNumber: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <label className="label">Catatan (opsional)</label>
                  <input
                    className="input"
                    placeholder="Contoh: transfer lalu hubungi admin"
                    value={a.notes}
                    onChange={(e) => update(a.id, { notes: e.target.value })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-[var(--fg-muted)]">
        Hanya metode yang dicentang <strong>Aktif</strong> yang muncul di
        halaman pembayaran customer.
      </p>
    </AdminShell>
  );
}
