"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/lib/money";

type Store = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  distanceKm: number;
  _count: { products: number };
};

export default function CustomerStoresPage() {
  const [lat, setLat] = useState(19.076);
  const [lng, setLng] = useState(72.8777);
  const [radiusKm, setRadiusKm] = useState(8);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/stores/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`, { credentials: "include" });
    const data = (await r.json()) as { stores: Store[] };
    setStores(data.stores);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoNote("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setGeoNote("Using your device location.");
      },
      () => setGeoNote("Location permission denied — showing Mumbai demo coordinates."),
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Nearby stores</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Geo discovery uses a Haversine radius (SQLite-friendly). Approve location for accurate results.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Radius (km)
            <input
              type="number"
              min={1}
              max={25}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="ml-2 w-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-95"
          >
            Use my location
          </button>
        </div>
      </div>
      {geoNote && <p className="mb-4 text-sm text-[var(--muted)]">{geoNote}</p>}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading stores…</p>
      ) : stores.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No approved stores in this radius.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {stores.map((s) => (
            <li key={s.id}>
              <Link
                href={`/customer/stores/${s.id}`}
                className="block rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">{s.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{s.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--muted-bg)] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {s.distanceKm.toFixed(1)} km
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">{s.address}</p>
                <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                  {s._count.products} products · from {formatInr(2800)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
