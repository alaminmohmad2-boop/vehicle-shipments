import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** People the Gateway signed in, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

/** Per-organization sequences: booking, invoice and credit note numbers. */
export const counters = sqliteTable(
  "counters",
  {
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    value: integer("value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.name] })],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ownerId: text("owner_id").notNull(),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull().default(""),
    consignee: text("consignee").notNull().default(""),
    carrier: text("carrier").notNull().default(""),
    vessel: text("vessel").notNull().default(""),
    voyage: text("voyage").notNull().default(""),
    cargoNotes: text("cargo_notes").notNull().default(""),
    status: text("status").notNull().default("booked"),
    trackingToken: text("tracking_token"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bookings_org_number").on(t.orgId, t.number),
    uniqueIndex("bookings_tracking_token").on(t.trackingToken),
    index("bookings_org_owner").on(t.orgId, t.ownerId),
  ],
);

export const legs = sqliteTable(
  "legs",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fromPort: text("from_port").notNull(),
    toPort: text("to_port").notNull(),
    vesselVoyage: text("vessel_voyage").notNull().default(""),
    etd: text("etd"),
    eta: text("eta"),
  },
  (t) => [index("legs_booking").on(t.bookingId, t.position)],
);

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    vin: text("vin").notNull(),
    make: text("make").notNull().default(""),
    model: text("model").notNull().default(""),
    year: integer("year"),
    lengthCm: integer("length_cm"),
    widthCm: integer("width_cm"),
    heightCm: integer("height_cm"),
    weightKg: integer("weight_kg"),
    /** Null: the vehicle follows the booking's status. */
    status: text("status"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vehicles_booking_vin").on(t.bookingId, t.vin)],
);

export const statusEvents = sqliteTable(
  "status_events",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    occurredAt: text("occurred_at").notNull(),
    location: text("location").notNull().default(""),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("status_events_booking").on(t.bookingId, t.occurredAt)],
);

/** Organization-wide price rules, kept by admins. Amounts in minor units. */
export const tariffs = sqliteTable(
  "tariffs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    basis: text("basis").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    carrier: text("carrier").notNull().default(""),
    originPort: text("origin_port").notNull().default(""),
    destinationPort: text("destination_port").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("tariffs_org").on(t.orgId)],
);

/** A booking's charge lines; invoiceId is set once a line is invoiced. */
export const charges = sqliteTable(
  "charges",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitMinor: integer("unit_minor").notNull(),
    currency: text("currency").notNull(),
    tariffId: text("tariff_id"),
    invoiceId: text("invoice_id"),
    createdAt: createdAt(),
  },
  (t) => [index("charges_booking").on(t.bookingId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    /** "invoice" or "credit_note". */
    kind: text("kind").notNull(),
    /** issued, paid or voided; a credit note is always issued. */
    status: text("status").notNull(),
    creditsInvoiceId: text("credits_invoice_id"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invoices_org_number").on(t.orgId, t.number),
    index("invoices_booking").on(t.bookingId),
  ],
);

export const invoiceLines = sqliteTable(
  "invoice_lines",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitMinor: integer("unit_minor").notNull(),
    currency: text("currency").notNull(),
  },
  (t) => [index("invoice_lines_invoice").on(t.invoiceId)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_booking").on(t.bookingId)],
);
