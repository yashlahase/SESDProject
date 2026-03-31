import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/70 bg-[color-mix(in_oklab,var(--card)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-[var(--foreground)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)] shadow-sm">
            KR
          </span>
          <span>KiranaReach</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-95"
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
