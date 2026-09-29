import { describe, expect, it } from "vitest";
import { addMonths, formatMoney, monthKey, monthLabelES, parseAmountToCents } from "./money";

describe("money", () => {
  it("formatMoney usa el formato peso", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(50)).toBe("$0.50");
  });

  it("parseAmountToCents convierte decimales y rechaza inválidos", () => {
    expect(parseAmountToCents("12.34")).toBe(1234);
    expect(parseAmountToCents("12")).toBe(1200);
    expect(parseAmountToCents("0.05")).toBe(5);
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("12.345")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("0")).toBeNull();
    expect(parseAmountToCents("-3")).toBeNull();
    expect(parseAmountToCents("   ")).toBeNull();
  });

  it("monthKey y addMonths cruzan años", () => {
    expect(monthKey(new Date(2026, 8, 28))).toBe("2026-09");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("monthLabelES formatea en español", () => {
    expect(monthLabelES("2026-09")).toBe("septiembre de 2026");
  });
});
