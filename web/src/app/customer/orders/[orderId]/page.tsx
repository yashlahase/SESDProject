"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderChat } from "@/components/OrderChat";
import { formatInr } from "@/lib/money";

type Order = {
  id: string;
  status: string;
  deliveryAddress: string;
  totalCents: number;
  createdAt: string;
  store: { name: string; address: string };
  delivery: { status: string; partner: { name: string } | null } | null;
  items: { quantity: number; unitPriceCents: number; product: { name: string } }[];
};

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { order: Order };
      if (!cancelled) setOrder(data.order);
    }
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [orderId]);

  if (!order) {
    return <p className="text-sm text-[var(--muted)]">Loading order…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/customer/orders" className="text-sm font-medium text-[var(--primary)] hover:underline">
          ← All orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{order.store.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{new Date(order.createdAt).toLocaleString()}</p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Status</h2>
          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{order.status.replaceAll("_", " ")}</p>
          {order.delivery && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Delivery: {order.delivery.status.replaceAll("_", " ")}
              {order.delivery.partner ? ` · ${order.delivery.partner.name}` : ""}
            </p>
          )}
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Deliver to</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{order.deliveryAddress}</p>
            <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">Store</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{order.store.address}</p>
          </div>
          <p className="mt-6 text-xl font-semibold text-[var(--foreground)]">{formatInr(order.totalCents)}</p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {it.product.name} × {it.quantity}
                </span>
                <span>{formatInr(it.unitPriceCents * it.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>
        <OrderChat orderId={order.id} />
      </section>
    </div>
  );
}
