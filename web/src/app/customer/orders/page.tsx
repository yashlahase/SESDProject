"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/lib/money";

type OrderRow = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  store: { name: string };
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/orders", { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { orders: OrderRow[] };
      if (!cancelled) setOrders(data.orders);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Your orders</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Track status and open the thread to chat with the store.</p>
      <ul className="mt-8 space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/customer/orders/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 shadow-sm hover:bg-[var(--muted-bg)]"
            >
              <div>
                <p className="font-semibold text-[var(--foreground)]">{o.store.name}</p>
                <p className="text-xs text-[var(--muted)]">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--foreground)]">{formatInr(o.totalCents)}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{o.status}</p>
              </div>
            </Link>
          </li>
        ))}
        {orders.length === 0 && <p className="text-sm text-[var(--muted)]">No orders yet.</p>}
      </ul>
    </div>
  );
}
