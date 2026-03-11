export type CartLine = { productId: string; storeId: string; name: string; quantity: number; unitPriceCents: number };

const KEY = "kirana_cart_v1";

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function addToCart(line: Omit<CartLine, "quantity"> & { quantity?: number }) {
  const cart = readCart();
  if (cart.length && cart[0].storeId !== line.storeId) {
    throw new Error("CART_STORE_MISMATCH");
  }
  const idx = cart.findIndex((c) => c.productId === line.productId);
  const qty = line.quantity ?? 1;
  if (idx >= 0) {
    cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + qty };
  } else {
    cart.push({
      productId: line.productId,
      storeId: line.storeId,
      name: line.name,
      unitPriceCents: line.unitPriceCents,
      quantity: qty,
    });
  }
  writeCart(cart);
}

export function setQuantity(productId: string, quantity: number) {
  const cart = readCart()
    .map((c) => (c.productId === productId ? { ...c, quantity } : c))
    .filter((c) => c.quantity > 0);
  writeCart(cart);
}

export function clearCart() {
  localStorage.removeItem(KEY);
}
