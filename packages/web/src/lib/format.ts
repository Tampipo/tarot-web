/** Signed score with an explicit + sign, e.g. +70 / −70 / 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export function scoreClass(n: number): string {
  return n > 0 ? "score pos" : n < 0 ? "score neg" : "score";
}

/** "Season 3 · Jul 2026 – ongoing" style range for a season. */
export function seasonRange(startedAt: string, endedAt: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${fmt(startedAt)} – ${endedAt ? fmt(endedAt) : "ongoing"}`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
