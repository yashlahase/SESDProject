"use client";

import { useEffect, useState } from "react";
import { OrderChat } from "@/components/OrderChat";
import { formatInr } from "@/lib/money";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  deliveryAddress: string;
  customer: { name: string; email: string };
  items: { quantity: number; product: { name: string } }[];
};

export default function StoreOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/orders", { credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { orders: Order[] };
    setOrders(data.orders);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  async function patch(id: string, action: "accept" | "reject" | "mark_ready") {
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) alert(await r.text());
    void refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Store orders</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Accept or reject with stock checks. Mark ready for pickup.</p>
      </div>

      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{o.status}</p>
                <p className="mt-1 font-semibold text-[var(--foreground)]">{o.customer.name}</p>
                <p className="text-sm text-[var(--muted)]">{o.customer.email}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{o.deliveryAddress}</p>
                <ul className="mt-3 text-sm text-[var(--foreground)]">
                  {o.items.map((it, i) => (
                    <li key={i}>
                      {it.product.name} × {it.quantity}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{formatInr(o.totalCents)}</p>
                <p className="text-xs text-[var(--muted)]">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {o.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => void patch(o.id, "accept")}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void patch(o.id, "reject")}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                  >
                    Reject
                  </button>
                </>
              )}
              {o.status === "ACCEPTED" && (
                <button
                  type="button"
                  onClick={() => void patch(o.id, "mark_ready")}
                  className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Mark ready for pickup
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((x) => (x === o.id ? null : o.id))}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                {expanded === o.id ? "Hide chat" : "Chat"}
              </button>
            </div>
            {expanded === o.id && (
              <div className="mt-6">
                <OrderChat orderId={o.id} />
              </div>
            )}
          </li>
        ))}
        {orders.length === 0 && <p className="text-sm text-[var(--muted)]">No orders yet.</p>}
      </ul>
    </div>
  );
}
