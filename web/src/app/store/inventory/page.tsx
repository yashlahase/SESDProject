"use client";

import { useEffect, useState } from "react";
import { formatInr } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
};

type Store = { id: string; name: string; products: Product[] };

export default function StoreInventoryPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [desc, setDesc] = useState("");

  async function refresh() {
    const r = await fetch("/api/store/me", { credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { store: Store };
    setStore(data.store);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    const priceCents = Math.round(Number(price) * 100);
    if (!name || !Number.isFinite(priceCents) || priceCents <= 0) return;
    await fetch(`/api/stores/${store.id}/products`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description: desc || undefined,
        priceCents,
        stock: Number(stock) || 0,
      }),
    });
    setName("");
    setPrice("");
    setStock("10");
    setDesc("");
    void refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete product?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" });
    void refresh();
  }

  if (!store) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Inventory</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{store.name}</p>
      </div>

      <form
        onSubmit={addProduct}
        className="grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Add product</h2>
        </div>
        <label className="text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Price (INR)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Stock
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type="number"
            min="0"
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Description
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="sm:col-span-2 rounded-2xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          Save product
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {store.products.map((p) => (
          <li key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--foreground)]">{p.name}</p>
                {p.description && <p className="text-sm text-[var(--muted)]">{p.description}</p>}
                <p className="mt-2 text-sm text-[var(--muted)]">Stock {p.stock}</p>
              </div>
              <p className="text-sm font-semibold">{formatInr(p.priceCents)}</p>
            </div>
            <button
              type="button"
              onClick={() => void remove(p.id)}
              className="mt-3 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
