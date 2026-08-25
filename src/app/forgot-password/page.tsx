"use client";

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="page-bg flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Lupa Password</h1>
        <p className="mt-3 text-sm text-[var(--fg-muted)]">
          Hubungi admin outlet untuk reset password akun Anda.
          <br />
          (MVP: fitur reset mandiri akan tersedia pada phase berikutnya)
        </p>
        <Link href="/login" className="btn btn-primary mt-6 inline-flex">
          Kembali Login
        </Link>
      </div>
    </div>
  );
}
