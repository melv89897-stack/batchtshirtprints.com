export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export function formatMultiple(x: number | null | undefined): string {
  if (x == null) return "—";
  return `${x.toFixed(1)}×`;
}

export function formatPercent(x: number | null | undefined): string {
  if (x == null) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

export function timeLeft(endsAt: Date | null | undefined): string {
  if (!endsAt) return "—";
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
