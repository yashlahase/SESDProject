"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import { formatInr } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
};

export default function StoreDetailPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sr, pr] = await Promise.all([
        fetch(`/api/stores/${storeId}`, { credentials: "include" }),
        fetch(`/api/stores/${storeId}/products`, { credentials: "include" }),
      ]);
      if (!sr.ok || !pr.ok) return;
      const s = (await sr.json()) as { store: { name: string } };
      const p = (await pr.json()) as { products: Product[] };
      if (!cancelled) {
        setStoreName(s.store.name);
        setProducts(p.products);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  function add(p: Product) {
    try {
      addToCart({
        productId: p.id,
        storeId,
        name: p.name,
        unitPriceCents: p.priceCents,
        quantity: 1,
      });
      setToast(`Added “${p.name}” to cart`);
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast("Your cart has items from another store. Clear the cart first.");
      setTimeout(() => setToast(null), 3200);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/customer/stores" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ← Back to stores
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{storeName || "Store"}</h1>
        </div>
        <Link
          href="/customer/cart"
          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold hover:bg-[var(--muted-bg)]"
        >
          View cart
        </Link>
      </div>
      {toast && (
        <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
          {toast}
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">{p.name}</h2>
                {p.description && <p className="mt-1 text-sm text-[var(--muted)]">{p.description}</p>}
                <p className="mt-2 text-sm text-[var(--muted)]">Stock: {p.stock}</p>
              </div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{formatInr(p.priceCents)}</p>
            </div>
            <button
              type="button"
              disabled={p.stock <= 0}
              onClick={() => add(p)}
              className="mt-4 w-full rounded-xl bg-[var(--primary)] py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to cart
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
