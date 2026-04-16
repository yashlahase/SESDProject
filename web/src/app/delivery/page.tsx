"use client";

import { useEffect, useState } from "react";
import { OrderChat } from "@/components/OrderChat";
import { formatInr } from "@/lib/money";

type Delivery = {
  id: string;
  status: string;
  order: {
    id: string;
    status: string;
    totalCents: number;
    deliveryAddress: string;
    store: { name: string; address: string; lat: number; lng: number };
    customer: { name: string };
  };
};

export default function DeliveryPage() {
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [openList, setOpenList] = useState<Delivery[]>([]);
  const [mine, setMine] = useState<Delivery[]>([]);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);

  async function refresh() {
    const [o, m] = await Promise.all([
      fetch("/api/deliveries?scope=open", { credentials: "include" }),
      fetch("/api/deliveries?scope=mine", { credentials: "include" }),
    ]);
    if (o.ok) setOpenList(((await o.json()) as { deliveries: Delivery[] }).deliveries);
    if (m.ok) setMine(((await m.json()) as { deliveries: Delivery[] }).deliveries);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  async function patch(id: string, action: "claim" | "pickup" | "at_customer" | "complete") {
    const r = await fetch(`/api/deliveries/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) alert(await r.text());
    void refresh();
  }

  const list = tab === "open" ? openList : mine;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Deliveries</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Claim open jobs, then advance status to complete.</p>
        </div>
        <div className="flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab("open")}
            className={`rounded-full px-4 py-2 ${tab === "open" ? "bg-[var(--muted-bg)]" : ""}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`rounded-full px-4 py-2 ${tab === "mine" ? "bg-[var(--muted-bg)]" : ""}`}
          >
            Mine
          </button>
        </div>
      </div>

      <ul className="space-y-4">
        {list.map((d) => (
          <li key={d.id} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{d.status}</p>
                <p className="mt-1 font-semibold text-[var(--foreground)]">{d.order.store.name}</p>
                <p className="text-sm text-[var(--muted)]">To: {d.order.customer.name}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{d.order.deliveryAddress}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Order {d.order.status}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{formatInr(d.order.totalCents)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tab === "open" && (
                <button
                  type="button"
                  onClick={() => void patch(d.id, "claim")}
                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
                >
                  Claim
                </button>
              )}
              {tab === "mine" && d.status === "ASSIGNED" && (
                <button
                  type="button"
                  onClick={() => void patch(d.id, "pickup")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                >
                  Picked up
                </button>
              )}
              {tab === "mine" && d.status === "PICKED_UP" && (
                <button
                  type="button"
                  onClick={() => void patch(d.id, "at_customer")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                >
                  At customer
                </button>
              )}
              {tab === "mine" && (d.status === "AT_CUSTOMER" || d.status === "PICKED_UP" || d.status === "ASSIGNED") && (
                <button
                  type="button"
                  onClick={() => void patch(d.id, "complete")}
                  className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Complete
                </button>
              )}
              {tab === "mine" && (
                <button
                  type="button"
                  onClick={() => setChatOrderId((x) => (x === d.order.id ? null : d.order.id))}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                >
                  {chatOrderId === d.order.id ? "Hide chat" : "Chat"}
                </button>
              )}
            </div>
            {tab === "mine" && chatOrderId === d.order.id && (
              <div className="mt-6">
                <OrderChat orderId={d.order.id} />
              </div>
            )}
          </li>
        ))}
        {list.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing here.</p>}
      </ul>
    </div>
  );
}
