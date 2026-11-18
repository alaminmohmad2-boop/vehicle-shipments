import { describe, expect, it } from "vitest";
import {
  createBookingInput,
  formatMoney,
  parseAmount,
  tariffMatches,
  tariffQuantity,
  totalsByCurrency,
  vehicleInput,
} from "./shipping";

describe("vehicles", () => {
  it("accepts a 17-character VIN without I, O or Q and upper-cases it", () => {
    expect(vehicleInput.parse({ vin: "5yj3e1ea7kf317001" }).vin).toBe(
      "5YJ3E1EA7KF317001",
    );
  });
  it("refuses short VINs and the letters I, O and Q", () => {
    for (const vin of [
      "5YJ3E1EA7KF31700",
      "5YJ3E1EA7KF31700I",
      "5YJ3E1EA7KF31700O",
      "5YJ3E1EA7KF31700Q",
    ]) {
      expect(vehicleInput.safeParse({ vin }).success).toBe(false);
    }
  });
  it("reads blank measurements as unknown", () => {
    const parsed = vehicleInput.parse({
      vin: "WVWZZZ1KZBW000001",
      year: "",
      weightKg: "1320",
    });
    expect(parsed.year).toBeNull();
    expect(parsed.weightKg).toBe(1320);
  });
});

describe("bookings", () => {
  it("needs a customer and at least one leg with both ports", () => {
    expect(
      createBookingInput.safeParse({
        customerName: "",
        customerEmail: "",
        legs: [],
      }).success,
    ).toBe(false);
    const ok = createBookingInput.safeParse({
      customerName: "Harbor Auto",
      customerEmail: "",
      legs: [{ fromPort: "Bremerhaven", toPort: "Baltimore" }],
    });
    expect(ok.success).toBe(true);
  });
});

describe("money", () => {
  it("parses and formats amounts in minor units", () => {
    expect(parseAmount("1,250.5")).toBe(125050);
    expect(parseAmount("abc")).toBeNull();
    expect(formatMoney(-6000, "USD")).toBe("-60.00 USD");
  });
  it("totals lines per currency", () => {
    expect(
      totalsByCurrency([
        { quantity: 2, unitMinor: 85000, currency: "USD" },
        { quantity: 1, unitMinor: 9500, currency: "USD" },
        { quantity: 1, unitMinor: 7000, currency: "EUR" },
      ]),
    ).toEqual([
      { currency: "EUR", minor: 7000 },
      { currency: "USD", minor: 179500 },
    ]);
  });
});

describe("tariff rules", () => {
  const booking = {
    carrier: "Nordic RoRo Line",
    origin: "Bremerhaven",
    destination: "Baltimore",
  };
  it("match when every scope they set matches", () => {
    expect(
      tariffMatches(
        {
          basis: "per_unit",
          carrier: "nordic roro line",
          originPort: "",
          destinationPort: "",
        },
        booking,
      ),
    ).toBe(true);
    expect(
      tariffMatches(
        {
          basis: "per_unit",
          carrier: "",
          originPort: "Antwerp",
          destinationPort: "",
        },
        booking,
      ),
    ).toBe(false);
  });
  it("count vehicles, bookings or days", () => {
    expect(tariffQuantity("per_unit", 3, 0)).toBe(3);
    expect(tariffQuantity("per_booking", 3, 0)).toBe(1);
    expect(tariffQuantity("per_day", 3, 4)).toBe(4);
  });
});
