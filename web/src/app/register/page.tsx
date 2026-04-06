"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarketingNav } from "@/components/MarketingNav";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not register");
      return;
    }
    router.push("/customer/stores");
    router.refresh();
  }

  return (
    <div className="min-h-full">
      <MarketingNav />
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Create a customer account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Store owners and delivery partners are provisioned by the platform in this demo.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </p>
          )}
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Password (min 8 characters)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
          <p className="text-center text-sm text-[var(--muted)]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
