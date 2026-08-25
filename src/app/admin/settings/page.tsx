"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Settings hub → rekening pembayaran (utama) */
export default function AdminSettingsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/payment-accounts");
  }, [router]);
  return null;
}
