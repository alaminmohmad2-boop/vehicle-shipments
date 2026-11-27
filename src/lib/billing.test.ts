import { describe, expect, it } from "vitest";
import {
  equivalents,
  grandTotals,
  invoiceBreakdown,
  parsePercent,
  parseRate,
} from "./shipping";

const lines = [
  { quantity: 2, unitMinor: 10000, currency: "USD" },
  { quantity: 1, unitMinor: 500000, currency: "SDG" },
];

describe("tax, fee and rate", () => {
  it("parses percentages and rates", () => {
    expect(parsePercent("10")).toBe(1000);
    expect(parsePercent("7.5%")).toBe(750);
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("101")).toBeNull();
    expect(parseRate("2,650.5")).toBe("2650.5");
    expect(parseRate("0")).toBeNull();
    expect(parseRate("")).toBe("");
  });
  it("adds tax on lines per currency, then the fee", () => {
    const rows = invoiceBreakdown(lines, {
      taxBps: 1000,
      feeMinor: 2500,
      feeCurrency: "USD",
    });
    expect(rows).toEqual([
      { currency: "SDG", subtotal: 500000, tax: 50000, fee: 0, total: 550000 },
      { currency: "USD", subtotal: 20000, tax: 2000, fee: 2500, total: 24500 },
    ]);
  });
  it("negates for credit notes", () => {
    const credit = lines.map((l) => ({ ...l, unitMinor: -l.unitMinor }));
    const totals = grandTotals(credit, {
      taxBps: 1000,
      feeMinor: -2500,
      feeCurrency: "USD",
    });
    expect(totals.find((m) => m.currency === "USD")?.minor).toBe(-24500);
  });
  it("converts with the typed rate only for USD and SDG", () => {
    const totals = [
      { currency: "SDG", minor: 550000 },
      { currency: "USD", minor: 24500 },
    ];
    expect(equivalents(totals, "2600")).toEqual({
      usd: 24500 + Math.round(550000 / 2600),
      sdg: 550000 + 24500 * 2600,
    });
    expect(equivalents(totals, "")).toBeNull();
    expect(equivalents([{ currency: "EUR", minor: 1 }], "2600")).toBeNull();
  });
});
