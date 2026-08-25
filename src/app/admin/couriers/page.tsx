"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminCouriersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/logistics");
  }, [router]);
  return null;
}
