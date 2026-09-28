import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, isoDay, monthRange, validAmountCents } from "../lib/money.js";

describe("money lib", () => {
  it("validAmountCents acepta solo enteros positivos", () => {
    expect(validAmountCents(100)).toBe(true);
    expect(validAmountCents(0)).toBe(false);
    expect(validAmountCents(-5)).toBe(false);
    expect(validAmountCents(1.5)).toBe(false);
    expect(validAmountCents("100")).toBe(false);
  });

  it("isoDay devuelve YYYY-MM-DD en hora local", () => {
    expect(isoDay(new Date(2026, 8, 28))).toBe("2026-09-28");
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("monthRange expande el mes incluyendo bisiestos", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("DEFAULT_CATEGORIES cubre ingresos y gastos con color hex", () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "income")).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "expense")).toBe(true);
    for (const c of DEFAULT_CATEGORIES) expect(/^#[0-9a-f]{6}$/i.test(c.color)).toBe(true);
  });
});
