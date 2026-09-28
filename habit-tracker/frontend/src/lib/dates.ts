export function localDateKey(offsetDays = 0, from?: Date): string {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];
