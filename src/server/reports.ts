import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, invoiceLines, invoices, legs, vehicles } from "@/db/schema";
import { minorToDecimal, toCsv } from "@/lib/csv";
import {
  grandTotals,
  mergeTotals,
  STATUSES,
  statusLabel,
  type Money,
} from "@/lib/shipping";
import { bookingScope, type Viewer } from "./access";

/** Everything a member may see, loaded once; fine for the size of one forwarder. */
async function load(user: Viewer) {
  const books = await db
    .select()
    .from(bookings)
    .where(bookingScope(user))
    .orderBy(asc(bookings.number));
  // Joins on the booking scope (no long id lists: D1 limits bound parameters).
  const [legRows, vehicleRows, invoiceRows, lineRows] = await Promise.all([
    db
      .select({ r: legs })
      .from(legs)
      .innerJoin(bookings, eq(bookings.id, legs.bookingId))
      .where(bookingScope(user))
      .orderBy(asc(legs.position)),
    db
      .select({ r: vehicles })
      .from(vehicles)
      .innerJoin(bookings, eq(bookings.id, vehicles.bookingId))
      .where(bookingScope(user)),
    db
      .select({ r: invoices })
      .from(invoices)
      .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
      .where(bookingScope(user)),
    db
      .select({ r: invoiceLines })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
      .where(bookingScope(user)),
  ]);
  return {
    books,
    legRows: legRows.map((x) => x.r),
    vehicleRows: vehicleRows.map((x) => x.r),
    invoiceRows: invoiceRows.map((x) => x.r),
    lineRows: lineRows.map((x) => x.r),
  };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function invoiceTotal(data: Loaded, invoice: Loaded["invoiceRows"][number]) {
  return grandTotals(
    data.lineRows.filter((l) => l.invoiceId === invoice.id),
    invoice,
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export async function getDashboard(user: Viewer) {
  const data = await load(user);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    string,
    number
  >;
  for (const b of data.books)
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  const open = data.invoiceRows.filter(
    (i) => i.kind === "invoice" && i.status === "issued",
  );
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today());
  const active = data.books.filter(
    (b) => b.status !== "delivered" && b.status !== "cancelled",
  );
  const unitsOf = (id: string) =>
    data.vehicleRows.filter((v) => v.bookingId === id).length;
  const routeOf = (id: string) => {
    const r = data.legRows.filter((l) => l.bookingId === id);
    return [r[0]?.fromPort, r.at(-1)?.toPort].filter(Boolean).join(" → ");
  };
  const paid = data.invoiceRows.filter(
    (i) => i.kind === "invoice" && i.status === "paid",
  );
  return {
    totalBookings: data.books.length,
    activeBookings: active.length,
    vehiclesInTransit: active.reduce((n, b) => n + unitsOf(b.id), 0),
    byStatus,
    openBalance: mergeTotals(open.map((i) => invoiceTotal(data, i))),
    overdueBalance: mergeTotals(overdue.map((i) => invoiceTotal(data, i))),
    overdueCount: overdue.length,
    paidTotal: mergeTotals(paid.map((i) => invoiceTotal(data, i))),
    active: active
      .slice(-8)
      .reverse()
      .map((b) => ({
        id: b.id,
        number: b.number,
        customerName: b.customerName,
        status: b.status,
        route: routeOf(b.id),
        units: unitsOf(b.id),
      })),
  };
}

/** Per customer: bookings, vehicles, invoiced, paid and still owed, by currency. */
export async function getCustomerReport(user: Viewer) {
  const data = await load(user);
  const names = [...new Set(data.books.map((b) => b.customerName))].sort(
    (a, b) => a.localeCompare(b),
  );
  return names.map((name) => {
    const books = data.books.filter((b) => b.customerName === name);
    const ids = new Set(books.map((b) => b.id));
    const inv = data.invoiceRows.filter((i) => ids.has(i.bookingId));
    const totals = (rows: typeof inv): Money[] =>
      mergeTotals(rows.map((i) => invoiceTotal(data, i)));
    return {
      customer: name,
      bookings: books.length,
      vehicles: data.vehicleRows.filter((v) => ids.has(v.bookingId)).length,
      invoiced: totals(
        inv.filter((i) => i.status !== "voided" && i.kind === "invoice"),
      ),
      paid: totals(
        inv.filter((i) => i.kind === "invoice" && i.status === "paid"),
      ),
      owed: totals(
        inv.filter((i) => i.kind === "invoice" && i.status === "issued"),
      ),
    };
  });
}

const money = (totals: Money[]) =>
  totals.map((m) => `${minorToDecimal(m.minor)} ${m.currency}`).join(" + ");

export type ExportKind = "bookings" | "vehicles" | "invoices" | "customers";

export async function exportCsv(
  user: Viewer,
  kind: ExportKind,
): Promise<string> {
  if (kind === "customers") {
    const rows = await getCustomerReport(user);
    return toCsv(
      ["Customer", "Bookings", "Vehicles", "Invoiced", "Paid", "Owed"],
      rows.map((r) => [
        r.customer,
        r.bookings,
        r.vehicles,
        money(r.invoiced),
        money(r.paid),
        money(r.owed),
      ]),
    );
  }
  const data = await load(user);
  const book = (id: string) => data.books.find((b) => b.id === id)!;
  if (kind === "bookings") {
    return toCsv(
      [
        "Booking",
        "Customer",
        "Consignee",
        "Carrier",
        "Vessel",
        "Voyage",
        "From",
        "To",
        "Status",
        "Vehicles",
        "Created",
      ],
      data.books.map((b) => {
        const r = data.legRows.filter((l) => l.bookingId === b.id);
        return [
          b.number,
          b.customerName,
          b.consignee,
          b.carrier,
          b.vessel,
          b.voyage,
          r[0]?.fromPort ?? "",
          r.at(-1)?.toPort ?? "",
          statusLabel(b.status),
          data.vehicleRows.filter((v) => v.bookingId === b.id).length,
          b.createdAt.slice(0, 10),
        ];
      }),
    );
  }
  if (kind === "vehicles") {
    return toCsv(
      [
        "Booking",
        "Customer",
        "VIN",
        "Make",
        "Model",
        "Year",
        "Length cm",
        "Width cm",
        "Height cm",
        "Weight kg",
        "Status",
      ],
      data.vehicleRows
        .slice()
        .sort((a, b) =>
          book(a.bookingId).number.localeCompare(book(b.bookingId).number),
        )
        .map((v) => [
          book(v.bookingId).number,
          book(v.bookingId).customerName,
          v.vin,
          v.make,
          v.model,
          v.year,
          v.lengthCm,
          v.widthCm,
          v.heightCm,
          v.weightKg,
          statusLabel(v.status ?? book(v.bookingId).status),
        ]),
    );
  }
  return toCsv(
    [
      "Invoice",
      "Type",
      "Booking",
      "Customer",
      "Issued",
      "Due",
      "Status",
      "Tax %",
      "Fee",
      "Exchange rate (SDG per USD)",
      "Total",
    ],
    data.invoiceRows
      .slice()
      .sort((a, b) => a.number.localeCompare(b.number))
      .map((i) => [
        i.number,
        i.kind === "credit_note" ? "Credit note" : "Invoice",
        book(i.bookingId).number,
        book(i.bookingId).customerName,
        i.issueDate,
        i.dueDate ?? "",
        i.status,
        i.taxBps / 100,
        i.feeMinor ? `${minorToDecimal(i.feeMinor)} ${i.feeCurrency}` : "",
        i.exchangeRate,
        money(invoiceTotal(data, i)),
      ]),
  );
}
