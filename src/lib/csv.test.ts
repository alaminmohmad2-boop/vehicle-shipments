import { describe, expect, it } from "vitest";
import { cell, minorToDecimal, toCsv } from "./csv";

describe("csv", () => {
  it("quotes and escapes", () => {
    expect(cell('a,"b"')).toBe('"a,""b"""');
    expect(cell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(cell(5)).toBe("5");
    expect(cell(-5)).toBe("-5");
  });
  it("starts with a BOM and uses CRLF", () => {
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("\uFEFFa,b\r\nx,1\r\n");
  });
  it("formats minor units", () => {
    expect(minorToDecimal(125050)).toBe("1250.50");
    expect(minorToDecimal(-5)).toBe("-0.05");
  });
});
