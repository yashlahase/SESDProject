"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clearCart, readCart, setQuantity, type CartLine } from "@/lib/cart";
import { enqueuePendingOrder } from "@/lib/offline-db";
import { formatInr } from "@/lib/money";

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [address, setAddress] = useState("Bandra West, Mumbai — near Linking Road");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setLines(readCart()), []);

  const total = useMemo(() => lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0), [lines]);

  async function placeOrder() {
    if (!lines.length) return;
    setSubmitting(true);
    setMsg(null);
    const storeId = lines[0].storeId;
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      storeId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      deliveryAddress: address,
      notes: notes || undefined,
      idempotencyKey,
    };
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        setMsg(t || "Order failed");
        return;
      }
      const data = (await r.json()) as { order: { id: string } };
      clearCart();
      setLines([]);
      window.location.href = `/customer/orders/${data.order.id}`;
    } catch {
      const localId = crypto.randomUUID();
      await enqueuePendingOrder({
        localId,
        idempotencyKey,
        payload: {
          storeId,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          deliveryAddress: address,
          notes: notes || undefined,
        },
        createdAt: Date.now(),
      });
      setMsg("Network issue — order was saved locally and will sync when you are back online.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Your cart</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Single-store cart with optimistic totals.</p>

      {!lines.length ? (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Cart is empty.{" "}
          <Link className="font-semibold text-[var(--primary)] hover:underline" href="/customer/stores">
            Browse stores
          </Link>
        </p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            {lines.map((l) => (
              <div
                key={l.productId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{l.name}</p>
                  <p className="text-sm text-[var(--muted)]">{formatInr(l.unitPriceCents)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg border border-[var(--border)] text-lg"
                    onClick={() => {
                      setQuantity(l.productId, l.quantity - 1);
                      setLines(readCart());
                    }}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg border border-[var(--border)] text-lg"
                    onClick={() => {
                      setQuantity(l.productId, l.quantity + 1);
                      setLines(readCart());
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                clearCart();
                setLines([]);
              }}
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Clear cart
            </button>
          </div>

          <div className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--foreground)]">Checkout</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{formatInr(total)}</p>
            <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
              Delivery address
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[var(--foreground)]">
              Notes (optional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              />
            </label>
            {msg && <p className="mt-3 text-sm text-[var(--muted)]">{msg}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void placeOrder()}
              className="mt-5 w-full rounded-2xl bg-[var(--primary)] py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "Placing…" : "Place order (idempotent)"}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              Each submission sends a stable idempotency key so retries never duplicate orders.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
