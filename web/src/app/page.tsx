import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";

export default function HomePage() {
  return (
    <div className="min-h-full">
      <MarketingNav />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Offline-first · Real-time · Neighborhood scale
              </p>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
                Quick commerce powered by your local kirana — not a distant warehouse.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
                KiranaReach digitizes inventory, orders, chat, and delivery tracking for customers, store owners,
                partners, and admins — with resilient sync when connectivity drops.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="rounded-2xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg shadow-emerald-900/10 hover:opacity-95"
                >
                  Shop as customer
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
                >
                  Open dashboard
                </Link>
              </div>
              <p className="mt-6 text-sm text-[var(--muted)]">
                Seeded roles: customer, store owner, delivery partner, and admin — use the login page hints to try each
                journey.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
              <div className="absolute inset-x-8 -top-24 h-48 rounded-full bg-gradient-to-br from-emerald-200/50 to-amber-200/40 blur-3xl dark:from-emerald-500/15 dark:to-amber-500/10" />
              <div className="relative space-y-4">
                <Stat title="15–30 min" subtitle="Target delivery window from nearby stores" />
                <Stat title="IndexedDB queue" subtitle="Orders survive flaky 2G/3G and sync on reconnect" />
                <Stat title="Socket.io chat" subtitle="Customers and merchants coordinate in real time" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_70%,var(--background))] py-14">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
            <Feature
              title="Customers"
              body="Discover approved stores by distance, search products, cart, place orders with idempotency keys, track status, and chat on the order thread."
            />
            <Feature
              title="Store owners"
              body="Manage catalog, accept or reject orders with safe stock checks, mark orders ready for pickup, and stay reachable over chat."
            />
            <Feature
              title="Delivery & admin"
              body="Partners claim open jobs, advance statuses, and complete deliveries. Admins oversee users and platform health."
            />
          </div>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
        Built as a course-aligned reference for a hyperlocal quick-commerce platform.
      </footer>
    </div>
  );
}

function Stat({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4 backdrop-blur">
      <p className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </div>
  );
}
