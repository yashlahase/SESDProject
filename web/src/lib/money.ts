export function formatInr(cents: number) {
  const v = cents / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}
