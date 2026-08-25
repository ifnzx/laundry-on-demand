"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui";

/** Weight is determined at outlet after pickup — this step is retired. */
export default function WeightRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/booking/address");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <LoadingBlock />
    </div>
  );
}
