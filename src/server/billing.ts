import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  bookings,
  charges,
  invoiceLines,
  invoices,
  legs,
  tariffs,
  vehicles,
} from "@/db/schema";
import {
  amountInput,
  BASES,
  currencyInput,
  tariffMatches,
  tariffQuantity,
  totalsByCurrency,
} from "@/lib/shipping";
import {
  bookingScope,
  formatNumber,
  nextNumber,
  requireAdmin,
  requireBooking,
  type Viewer,
} from "./access";

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date");

// ---- Tariff rules (organization-wide, admins change them) ----

export const tariffInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Enter a charge name").max(120),
  basis: z.enum(BASES),
  amount: amountInput,
  currency: currencyInput,
  carrier: z.string().trim().max(120).default(""),
  originPort: z.string().trim().max(120).default(""),
  destinationPort: z.string().trim().max(120).default(""),
});

export function listTariffs(user: Viewer) {
  return db
    .select()
    .from(tariffs)
    .where(eq(tariffs.orgId, user.orgId))
    .orderBy(asc(tariffs.name), asc(tariffs.createdAt));
}

export async function saveTariff(
  user: Viewer,
  input: z.output<typeof tariffInput>,
) {
  requireAdmin(user);
  const { id: tariffId, amount, ...rest } = input;
  const values = { ...rest, amountMinor: amount };
  if (tariffId) {
    await db
      .update(tariffs)
      .set(values)
      .where(and(eq(tariffs.id, tariffId), eq(tariffs.orgId, user.orgId)));
  } else {
    await db
      .insert(tariffs)
      .values({ id: crypto.randomUUID(), orgId: user.orgId, ...values });
  }
  return { ok: true };
}

export async function deleteTariff(user: Viewer, tariffId: string) {
  requireAdmin(user);
  await db
    .delete(tariffs)
    .where(and(eq(tariffs.id, tariffId), eq(tariffs.orgId, user.orgId)));
  return { ok: true };
}

// ---- Charge lines ----

export const applyTariffsInput = z.object({
  bookingId: id,
  days: z.number().int().min(0).max(3650).default(0),
});

/** Adds a line for each rule that matches the booking's carrier and route. */
export async function applyTariffs(
  user: Viewer,
  input: z.output<typeof applyTariffsInput>,
) {
  const booking = await requireBooking(user, input.bookingId);
  const [route, [{ count }], rules] = await Promise.all([
    db
      .select()
      .from(legs)
      .where(eq(legs.bookingId, booking.id))
      .orderBy(asc(legs.position)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.bookingId, booking.id)),
    listTariffs(user),
  ]);
  const scope = {
    carrier: booking.carrier,
    origin: route[0]?.fromPort ?? null,
    destination: route.at(-1)?.toPort ?? null,
  };
  const lines = rules
    .filter((rule) => tariffMatches(rule, scope))
    .map((rule) => ({
      rule,
      quantity: tariffQuantity(rule.basis, count, input.days),
    }))
    .filter((line) => line.quantity > 0)
    .map(({ rule, quantity }) => ({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      description: rule.name,
      quantity,
      unitMinor: rule.amountMinor,
      currency: rule.currency,
      tariffId: rule.id,
    }));
  if (lines.length) await db.insert(charges).values(lines);
  return { added: lines.length };
}

export const chargeInput = z.object({
  bookingId: id,
  description: z.string().trim().min(1, "Enter a description").max(200),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,5}$/, "Enter a whole number")
    .transform(Number),
  unitPrice: amountInput,
  currency: currencyInput,
});

export async function addCharge(
  user: Viewer,
  input: z.output<typeof chargeInput>,
) {
  await requireBooking(user, input.bookingId);
  await db.insert(charges).values({
    id: crypto.randomUUID(),
    bookingId: input.bookingId,
    description: input.description,
    quantity: input.quantity,
    unitMinor: input.unitPrice,
    currency: input.currency,
  });
  return { ok: true };
}

export const chargeRef = z.object({ bookingId: id, id });

/** Only a line not yet on an invoice can go. */
export async function removeCharge(
  user: Viewer,
  input: z.output<typeof chargeRef>,
) {
  await requireBooking(user, input.bookingId);
  await db
    .delete(charges)
    .where(
      and(
        eq(charges.id, input.id),
        eq(charges.bookingId, input.bookingId),
        isNull(charges.invoiceId),
      ),
    );
  return { ok: true };
}

// ---- Invoices ----

export const issueInvoiceInput = z.object({
  bookingId: id,
  issueDate: isoDate,
  dueDate: isoDate.or(z.literal("")).default(""),
});

/** Turns every uninvoiced line into one invoice; its lines never change afterwards. */
export async function issueInvoice(
  user: Viewer,
  input: z.output<typeof issueInvoiceInput>,
) {
  const booking = await requireBooking(user, input.bookingId);
  const open = await db
    .select()
    .from(charges)
    .where(and(eq(charges.bookingId, booking.id), isNull(charges.invoiceId)))
    .orderBy(asc(charges.createdAt), asc(sql`rowid`));
  if (!open.length) throw new Error("Add a charge first");
  const invoiceId = crypto.randomUUID();
  const number = formatNumber("INV", await nextNumber(user.orgId, "invoice"));
  await db.batch([
    db.insert(invoices).values({
      id: invoiceId,
      orgId: user.orgId,
      bookingId: booking.id,
      number,
      kind: "invoice",
      status: "issued",
      issueDate: input.issueDate,
      dueDate: input.dueDate || null,
    }),
    db.insert(invoiceLines).values(
      open.map((line, position) => ({
        id: crypto.randomUUID(),
        invoiceId,
        position,
        description: line.description,
        quantity: line.quantity,
        unitMinor: line.unitMinor,
        currency: line.currency,
      })),
    ),
    db
      .update(charges)
      .set({ invoiceId })
      .where(
        and(
          inArray(
            charges.id,
            open.map((line) => line.id),
          ),
          isNull(charges.invoiceId),
        ),
      ),
  ]);
  return { id: invoiceId, number };
}

async function requireInvoice(user: Viewer, invoiceId: string) {
  const [row] = await db
    .select({ invoice: invoices })
    .from(invoices)
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.orgId, user.orgId),
        bookingScope(user),
      ),
    );
  if (!row) throw new Error("Invoice not found");
  return row.invoice;
}

export async function markPaid(user: Viewer, invoiceId: string) {
  const invoice = await requireInvoice(user, invoiceId);
  if (invoice.kind !== "invoice" || invoice.status !== "issued") {
    throw new Error("Only an open invoice can be marked paid");
  }
  await db
    .update(invoices)
    .set({ status: "paid" })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "issued")));
  return { ok: true };
}

/** Voids an unpaid invoice with a credit note that negates it; its charge lines can be invoiced again. */
export async function voidInvoice(user: Viewer, invoiceId: string) {
  const invoice = await requireInvoice(user, invoiceId);
  if (invoice.kind !== "invoice" || invoice.status !== "issued") {
    throw new Error("Only an unpaid invoice can be voided");
  }
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.position));
  const creditId = crypto.randomUUID();
  const number = formatNumber(
    "CN",
    await nextNumber(user.orgId, "credit_note"),
  );
  await db.batch([
    db
      .update(invoices)
      .set({ status: "voided" })
      .where(eq(invoices.id, invoiceId)),
    db.insert(invoices).values({
      id: creditId,
      orgId: user.orgId,
      bookingId: invoice.bookingId,
      number,
      kind: "credit_note",
      status: "issued",
      creditsInvoiceId: invoiceId,
      issueDate: new Date().toISOString().slice(0, 10),
    }),
    db.insert(invoiceLines).values(
      lines.map((line) => ({
        id: crypto.randomUUID(),
        invoiceId: creditId,
        position: line.position,
        description: line.description,
        quantity: line.quantity,
        unitMinor: -line.unitMinor,
        currency: line.currency,
      })),
    ),
    db
      .update(charges)
      .set({ invoiceId: null })
      .where(eq(charges.invoiceId, invoiceId)),
  ]);
  return { ok: true };
}

/** A booking's charges, invoices and money summary. */
export async function getBilling(user: Viewer, bookingId: string) {
  await requireBooking(user, bookingId);
  const [lines, docs, docLines] = await Promise.all([
    db
      .select()
      .from(charges)
      .where(eq(charges.bookingId, bookingId))
      .orderBy(asc(charges.createdAt), asc(sql`rowid`)),
    db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.createdAt), desc(invoices.number)),
    db
      .select({
        invoiceId: invoiceLines.invoiceId,
        quantity: invoiceLines.quantity,
        unitMinor: invoiceLines.unitMinor,
        currency: invoiceLines.currency,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(eq(invoices.bookingId, bookingId)),
  ]);
  const linesOf = (docId: string) =>
    docLines.filter((line) => line.invoiceId === docId);
  const numberOf = new Map(docs.map((doc) => [doc.id, doc.number]));
  return {
    charges: lines.map((line) => ({
      ...line,
      invoiceNumber: line.invoiceId
        ? (numberOf.get(line.invoiceId) ?? null)
        : null,
    })),
    invoices: docs.map((doc) => ({
      ...doc,
      credits: doc.creditsInvoiceId
        ? (numberOf.get(doc.creditsInvoiceId) ?? null)
        : null,
      totals: totalsByCurrency(linesOf(doc.id)),
    })),
    invoiced: totalsByCurrency(docLines),
    open: totalsByCurrency(
      docs
        .filter((doc) => doc.kind === "invoice" && doc.status === "issued")
        .flatMap((doc) => linesOf(doc.id)),
    ),
  };
}

/** An invoice or credit note with its booking, for the printable page. */
export async function getInvoiceDocument(user: Viewer, invoiceId: string) {
  const invoice = await requireInvoice(user, invoiceId).catch(() => null);
  if (!invoice) return null;
  const booking = await requireBooking(user, invoice.bookingId);
  const [lines, route, credits] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(asc(invoiceLines.position)),
    db
      .select()
      .from(legs)
      .where(eq(legs.bookingId, booking.id))
      .orderBy(asc(legs.position)),
    invoice.creditsInvoiceId
      ? db
          .select({ number: invoices.number })
          .from(invoices)
          .where(eq(invoices.id, invoice.creditsInvoiceId))
      : Promise.resolve([]),
  ]);
  return {
    invoice: { ...invoice, credits: credits[0]?.number ?? null },
    booking: {
      id: booking.id,
      number: booking.number,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      vessel: booking.vessel,
      voyage: booking.voyage,
      origin: route[0]?.fromPort ?? "",
      destination: route.at(-1)?.toPort ?? "",
    },
    lines,
    totals: totalsByCurrency(lines),
  };
}
