"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; role: string } | null;

const links: Record<string, { href: string; label: string }[]> = {
  CUSTOMER: [
    { href: "/customer/stores", label: "Stores" },
    { href: "/customer/cart", label: "Cart" },
    { href: "/customer/orders", label: "Orders" },
  ],
  STORE_OWNER: [
    { href: "/store/inventory", label: "Inventory" },
    { href: "/store/orders", label: "Orders" },
  ],
  DELIVERY: [{ href: "/delivery", label: "Deliveries" }],
  ADMIN: [{ href: "/admin", label: "Admin" }],
};

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/me", { credentials: "include" });
      const data = (await r.json()) as { user: Me };
      if (!cancelled) setMe(data.user);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  if (me === undefined) {
    return (
      <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="h-5 w-40 animate-pulse rounded bg-[var(--muted-bg)]" />
        </div>
      </header>
    );
  }

  if (!me) return null;

  const nav = links[me.role] ?? [];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_90%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold tracking-tight text-[var(--foreground)]">
            KiranaReach
          </Link>
          <span className="hidden text-sm text-[var(--muted)] sm:inline">{me.name}</span>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {nav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                pathname === l.href || pathname.startsWith(l.href + "/")
                  ? "bg-[var(--muted-bg)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-1 rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
