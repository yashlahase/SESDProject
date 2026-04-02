"use client";

import { useEffect, useRef } from "react";
import { bumpRetry, listPendingOrders, removePendingOrder } from "@/lib/offline-db";

async function postOrder(payload: {
  storeId: string;
  items: { productId: string; quantity: number }[];
  deliveryAddress: string;
  notes?: string;
  idempotencyKey: string;
}) {
  const res = await fetch("/api/orders", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "Idempotency-Key": payload.idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ order: { id: string } }>;
}

export function OfflineSync() {
  const syncing = useRef(false);

  useEffect(() => {
    async function flush() {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const pending = await listPendingOrders();
        for (const p of pending) {
          if (p.retryCount > 8) continue;
          try {
            await postOrder({ ...p.payload, idempotencyKey: p.idempotencyKey });
            await removePendingOrder(p.localId);
          } catch {
            await bumpRetry(p.localId);
          }
        }
      } finally {
        syncing.current = false;
      }
    }

    const onOnline = () => {
      void flush();
    };
    window.addEventListener("online", onOnline);
    void flush();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
