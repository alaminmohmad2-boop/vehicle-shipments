// VIN decoding with the free NHTSA vPIC service (no key, no cost).
// It knows US-market vehicles best; many Asian and European VINs return
// little or nothing, and then the fields stay for the person to fill in.

export type Decoded =
  | { found: true; make: string; model: string; year: string }
  | { found: false; reason: "invalid" | "unknown" | "unavailable" };

const title = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    // Short brand names such as BMW stay upper case.
    .replace(/^(Bmw|Gmc|Ram|Kia|Mg)$/i, (m) => m.toUpperCase());

export async function decodeVin(vin: string): Promise<Decoded> {
  const clean = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) {
    return { found: false, reason: "invalid" };
  }
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${clean}?format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return { found: false, reason: "unavailable" };
    const body = (await response.json()) as {
      Results?: Record<string, string>[];
    };
    const row = body.Results?.[0];
    const make = row?.Make?.trim() ?? "";
    const model = row?.Model?.trim() ?? "";
    const year = row?.ModelYear?.trim() ?? "";
    if (!make && !model) return { found: false, reason: "unknown" };
    return { found: true, make: title(make), model, year };
  } catch {
    return { found: false, reason: "unavailable" };
  }
}
