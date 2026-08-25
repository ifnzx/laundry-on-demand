"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { OrderChat } from "@/components/order-chat";
import { LoadingBlock } from "@/components/ui";
import { api } from "@/lib/client-api";

export default function CustomerOrderChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await api("/api/auth");
      if (!me.success) {
        router.push("/login");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <CustomerShell hideNav>
        <LoadingBlock />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell hideNav>
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col">
        <OrderChat
          orderId={id}
          role="customer"
          backHref="/messages"
          className="h-full min-h-0"
        />
      </div>
    </CustomerShell>
  );
}
