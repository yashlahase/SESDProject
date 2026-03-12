import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type PendingOrder = {
  localId: string;
  idempotencyKey: string;
  payload: {
    storeId: string;
    items: { productId: string; quantity: number }[];
    deliveryAddress: string;
    notes?: string;
  };
  createdAt: number;
  retryCount: number;
};

interface KiranaDB extends DBSchema {
  pending_orders: {
    key: string;
    value: PendingOrder;
    indexes: { "by-created": number };
  };
}

let dbPromise: Promise<IDBPDatabase<KiranaDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<KiranaDB>("kirana-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("pending_orders", { keyPath: "localId" });
        store.createIndex("by-created", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueuePendingOrder(entry: Omit<PendingOrder, "retryCount">) {
  const db = await getDb();
  const row: PendingOrder = { ...entry, retryCount: 0 };
  await db.put("pending_orders", row);
}

export async function listPendingOrders(): Promise<PendingOrder[]> {
  const db = await getDb();
  const all = await db.getAll("pending_orders");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePendingOrder(localId: string) {
  const db = await getDb();
  await db.delete("pending_orders", localId);
}

export async function bumpRetry(localId: string) {
  const db = await getDb();
  const row = await db.get("pending_orders", localId);
  if (!row) return;
  row.retryCount += 1;
  await db.put("pending_orders", row);
}
