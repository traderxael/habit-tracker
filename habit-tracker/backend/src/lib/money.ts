export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

export function validAmountCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export interface DefaultCategory {
  name: string;
  icon: string;
  type: "income" | "expense";
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Comida", icon: "🍔", type: "expense", color: "#f97316" },
  { name: "Transporte", icon: "🚌", type: "expense", color: "#0ea5e9" },
  { name: "Hogar", icon: "🏠", type: "expense", color: "#8b5cf6" },
  { name: "Salud", icon: "💊", type: "expense", color: "#ef4444" },
  { name: "Ocio", icon: "🎮", type: "expense", color: "#ec4899" },
  { name: "Otros", icon: "📦", type: "expense", color: "#64748b" },
  { name: "Nómina", icon: "💼", type: "income", color: "#22c55e" },
  { name: "Freelance", icon: "💻", type: "income", color: "#14b8a6" },
  { name: "Inversiones", icon: "📈", type: "income", color: "#eab308" },
];
