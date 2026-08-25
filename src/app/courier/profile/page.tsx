"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourierShell } from "@/components/courier-shell";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";

type User = {
  name: string;
  phone: string;
  email?: string | null;
  vehicle?: string | null;
  rating: number;
  isOnline: boolean;
};

export default function CourierProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api<User>("/api/auth");
      if (!me.success) {
        router.push("/courier/login");
        return;
      }
      setUser(me.data || null);
    })();
  }, [router]);

  if (!user) {
    return (
      <CourierShell>
        <LoadingBlock />
      </CourierShell>
    );
  }

  return (
    <CourierShell>
      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl font-semibold">Profil</h1>
        <div className="card mt-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand)] text-2xl font-bold text-white">
            {user.name.charAt(0)}
          </div>
          <p className="mt-3 text-xl font-semibold">{user.name}</p>
          <p className="text-sm text-[var(--fg-muted)]">{user.phone}</p>
          {user.email && (
            <p className="text-sm text-[var(--fg-muted)]">{user.email}</p>
          )}
          <p className="mt-2 text-sm">
            Kendaraan: {user.vehicle || "—"} · Rating {user.rating} ★
          </p>
          <p className="text-sm">
            Status: {user.isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>
    </CourierShell>
  );
}
