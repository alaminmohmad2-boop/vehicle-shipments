import { z } from "zod";
import { t } from "@/lib/i18n";

// Shared by pages and the server: the milestones, the field rules and money.

export const STATUSES = [
  "booked",
  "documents_ready",
  "customs_cleared",
  "loaded",
  "arrived",
  "delivered",
  "cancelled",
] as const;
export type Status = (typeof STATUSES)[number];

const STATUS_EN: Record<Status, string> = {
  booked: "Booked",
  documents_ready: "Documents ready",
  customs_cleared: "Customs cleared",
  loaded: "Loaded / en route",
  arrived: "Arrived",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_LABELS = new Proxy(STATUS_EN, {
  get: (o, k) => t(o[k as Status] ?? String(k)),
});

/** Bookings in these states keep their vehicles as they are until reopened. */
export const LOCKED_STATUSES: readonly Status[] = ["delivered", "cancelled"];

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as Status] ?? status;
}

export const BASES = ["per_unit", "per_booking", "per_day"] as const;
export type Basis = (typeof BASES)[number];
const BASIS_EN: Record<Basis, string> = {
  per_unit: "Per vehicle",
  per_booking: "Per booking",
  per_day: "Per day",
};

export const BASIS_LABELS = new Proxy(BASIS_EN, {
  get: (o, k) => t(o[k as Basis] ?? String(k)),
});

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_MESSAGE = "17 letters and digits, without I, O or Q";

const text = (max: number) => z.string().trim().max(max);
const date = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-12-31");
const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .default(null)
    .transform((value) => (value == null ? "" : String(value).trim()))
    .refine(
      (value) =>
        value === "" ||
        (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max),
      message,
    )
    .transform((value) => (value === "" ? null : Number(value)));

export const legInput = z.object({
  fromPort: text(120).min(1, "Enter the port of loading"),
  toPort: text(120).min(1, "Enter the port of discharge"),
  vesselVoyage: text(120).default(""),
  etd: date.default(""),
  eta: date.default(""),
});

export const bookingFields = z.object({
  customerName: text(200).min(1, "Enter the customer's name"),
  customerEmail: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email",
    ),
  consignee: text(200).default(""),
  carrier: text(120).default(""),
  vessel: text(120).default(""),
  voyage: text(60).default(""),
  cargoNotes: text(2000).default(""),
});
export type BookingFields = z.input<typeof bookingFields>;

export const createBookingInput = bookingFields.extend({
  legs: z.array(legInput).min(1).max(20),
});

export const vehicleInput = z.object({
  vin: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => VIN.test(value), VIN_MESSAGE),
  make: text(80).default(""),
  model: text(80).default(""),
  year: optionalInt(1900, 2100, "Enter a year between 1900 and 2100"),
  lengthCm: optionalInt(1, 5000, "Enter centimetres"),
  widthCm: optionalInt(1, 1000, "Enter centimetres"),
  heightCm: optionalInt(1, 1000, "Enter centimetres"),
  weightKg: optionalInt(1, 100000, "Enter kilograms"),
  status: z.enum(STATUSES).nullable().default(null),
});

export const currencyInput = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => /^[A-Z]{3}$/.test(value),
    "Use a 3-letter code such as USD",
  );

/** "1,250.5" → 125050 minor units; null when it isn't an amount. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const amountInput = z
  .string()
  .refine(
    (value) => parseAmount(value) !== null,
    "Enter an amount such as 120 or 62.50",
  )
  .transform((value) => parseAmount(value)!);

export function formatMoney(minor: number, currency: string): string {
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(minor) / 100);
  return `${minor < 0 ? "-" : ""}${amount} ${currency}`;
}

export type Money = { currency: string; minor: number };

/** Sums lines per currency, in currency order. */
export function totalsByCurrency(
  lines: { quantity: number; unitMinor: number; currency: string }[],
): Money[] {
  const sums = new Map<string, number>();
  for (const line of lines) {
    sums.set(
      line.currency,
      (sums.get(line.currency) ?? 0) + line.quantity * line.unitMinor,
    );
  }
  return [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, minor]) => ({ currency, minor }));
}

export function formatTotals(totals: Money[]): string {
  if (totals.length === 0) return "—";
  return totals
    .map((total) => formatMoney(total.minor, total.currency))
    .join(", ");
}

/** "10" or "7.5" → 1000 or 750 basis points; null when it isn't a percentage (0 to 100). */
export function parsePercent(value: string): number | null {
  const cleaned = value.trim().replace(/%$/, "").trim();
  if (cleaned === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const bps = Math.round(Number(cleaned) * 100);
  return bps <= 10000 ? bps : null;
}

export function formatPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/** An exchange rate such as "2600" or "2650.5" (up to 4 decimals), > 0; "" when empty; null when invalid. */
export function parseRate(value: string): string | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return "";
  if (!/^\d{1,9}(\.\d{1,4})?$/.test(cleaned) || Number(cleaned) <= 0)
    return null;
  return String(Number(cleaned));
}

export const CURRENCIES = ["USD", "SDG", "EUR", "AED", "SAR", "EGP", "GBP"];

export type Extras = {
  taxBps: number;
  feeMinor: number;
  feeCurrency: string;
};

export type Breakdown = {
  currency: string;
  subtotal: number;
  tax: number;
  fee: number;
  total: number;
};

const roundHalfAway = (n: number) => Math.sign(n) * Math.round(Math.abs(n));

/** Per currency: lines, then tax on the lines, then the fee. */
export function invoiceBreakdown(
  lines: { quantity: number; unitMinor: number; currency: string }[],
  extras: Extras,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  const row = (currency: string) => {
    let r = map.get(currency);
    if (!r)
      map.set(
        currency,
        (r = { currency, subtotal: 0, tax: 0, fee: 0, total: 0 }),
      );
    return r;
  };
  for (const total of totalsByCurrency(lines)) {
    const r = row(total.currency);
    r.subtotal = total.minor;
    r.tax = roundHalfAway((total.minor * extras.taxBps) / 10000);
  }
  if (extras.feeMinor !== 0 && extras.feeCurrency) {
    row(extras.feeCurrency).fee = extras.feeMinor;
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: r.subtotal + r.tax + r.fee }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Grand totals per currency of one invoice. */
export function grandTotals(
  lines: { quantity: number; unitMinor: number; currency: string }[],
  extras: Extras,
): Money[] {
  return invoiceBreakdown(lines, extras).map((r) => ({
    currency: r.currency,
    minor: r.total,
  }));
}

export function mergeTotals(groups: Money[][]): Money[] {
  const sums = new Map<string, number>();
  for (const group of groups)
    for (const m of group)
      sums.set(m.currency, (sums.get(m.currency) ?? 0) + m.minor);
  return [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, minor]) => ({ currency, minor }));
}

/**
 * With the typed rate (SDG for 1 USD), the whole invoice in USD and in SDG.
 * Only USD and SDG amounts convert; null when there is no rate or another currency is present.
 */
export function equivalents(
  totals: Money[],
  rate: string,
): { usd: number; sdg: number } | null {
  const r = Number(rate);
  if (!rate || !(r > 0)) return null;
  if (totals.some((m) => m.currency !== "USD" && m.currency !== "SDG"))
    return null;
  const usd = totals.find((m) => m.currency === "USD")?.minor ?? 0;
  const sdg = totals.find((m) => m.currency === "SDG")?.minor ?? 0;
  return {
    usd: Math.round(usd + sdg / r),
    sdg: Math.round(sdg + usd * r),
  };
}

type Rule = {
  basis: string;
  carrier: string;
  originPort: string;
  destinationPort: string;
};

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** A rule applies when each scope it sets (carrier, origin, destination) matches the booking. */
export function tariffMatches(
  rule: Rule,
  booking: {
    carrier: string;
    origin: string | null;
    destination: string | null;
  },
): boolean {
  if (rule.carrier && !same(rule.carrier, booking.carrier)) return false;
  if (rule.originPort && !same(rule.originPort, booking.origin ?? ""))
    return false;
  if (
    rule.destinationPort &&
    !same(rule.destinationPort, booking.destination ?? "")
  )
    return false;
  return true;
}

/** How many of a rule's unit a booking is charged; 0 means no line. */
export function tariffQuantity(
  basis: string,
  vehicles: number,
  days: number,
): number {
  if (basis === "per_unit") return vehicles;
  if (basis === "per_day") return days;
  return 1;
}

/** Field errors keyed by the first path segment, for inline messages. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}
