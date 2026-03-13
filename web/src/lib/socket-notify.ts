const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
const key = process.env.INTERNAL_SOCKET_SECRET;

export async function notifyOrderUpdated(orderId: string) {
  if (!key) return;
  try {
    await fetch(`${url}/internal/emit-order`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    /* socket server may be down in dev */
  }
}
