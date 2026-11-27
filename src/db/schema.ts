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
    /** Tax in basis points (1000 = 10%), applied to the lines of each currency. */
    taxBps: integer("tax_bps").notNull().default(0),
    /** One fee on the invoice, in its own currency (empty when none). */
    feeMinor: integer("fee_minor").notNull().default(0),
    feeCurrency: text("fee_currency").notNull().default(""),
    /** Typed by the user: Sudanese pounds for 1 US dollar. Empty when none. */
    exchangeRate: text("exchange_rate").notNull().default(""),
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

/** Company details printed on invoices and bills of lading: one row per organization. */
export const companySettings = sqliteTable("company_settings", {
  orgId: text("org_id").primaryKey(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  /** The logo as a data URL (PNG, JPEG or SVG, up to 200 KB). */
  logo: text("logo").notNull().default(""),
  /** Tax suggested on each new invoice, in basis points (1000 = 10%). */
  defaultTaxBps: integer("default_tax_bps").notNull().default(0),
  updatedAt: createdAt(),
});

/**
 * Messages to customers about a booking's progress. Every message is recorded
 * here; "logged" means no provider sent it (the default, nothing leaves the app).
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    bookingId: text("booking_id").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    provider: text("provider").notNull(),
    state: text("state").notNull(),
    error: text("error").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_booking").on(t.bookingId)],
);

/** Storage yards (ported from SWAKEN): where vehicles wait before release. */
export const yards = sqliteTable(
  "yards",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    capacity: integer("capacity").notNull().default(100),
    /** active | closed */
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("yards_org_code").on(t.orgId, t.code)],
);

/**
 * The append-only movement history of a yard: gate entry and exit, and moves
 * between slots or yards. A vehicle is in a yard when its latest event there is
 * not an exit.
 */
export const yardEvents = sqliteTable(
  "yard_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    yardId: text("yard_id")
      .notNull()
      .references(() => yards.id, { onDelete: "cascade" }),
    vin: text("vin").notNull(),
    /** entry | exit | move */
    kind: text("kind").notNull(),
    zone: text("zone").notNull().default(""),
    slot: text("slot").notNull().default(""),
    gate: text("gate").notNull().default(""),
    driverName: text("driver_name").notNull().default(""),
    carrier: text("carrier").notNull().default(""),
    truckPlate: text("truck_plate").notNull().default(""),
    sealNumber: text("seal_number").notNull().default(""),
    notes: text("notes").notNull().default(""),
    actorEmail: text("actor_email").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("yard_events_org_vin").on(t.orgId, t.vin),
    index("yard_events_yard").on(t.yardId),
  ],
);

export const inspections = sqliteTable(
  "inspections",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    yardId: text("yard_id").references(() => yards.id, {
      onDelete: "set null",
    }),
    vin: text("vin").notNull(),
    /** gate_in | storage | gate_out */
    stage: text("stage").notNull().default("gate_in"),
    /** good | fair | damaged */
    condition: text("condition").notNull().default("good"),
    odometerKm: integer("odometer_km"),
    fuelPercent: integer("fuel_percent"),
    damageNotes: text("damage_notes").notNull().default(""),
    inspectorEmail: text("inspector_email").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("inspections_org_vin").on(t.orgId, t.vin)],
);

export const releaseRequests = sqliteTable(
  "release_requests",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    yardId: text("yard_id").references(() => yards.id, {
      onDelete: "set null",
    }),
    vin: text("vin").notNull(),
    customerName: text("customer_name").notNull().default(""),
    recipientName: text("recipient_name").notNull(),
    recipientId: text("recipient_id").notNull().default(""),
    recipientPhone: text("recipient_phone").notNull().default(""),
    pickupDate: text("pickup_date").notNull().default(""),
    /** pending | approved | rejected | released */
    status: text("status").notNull().default("pending"),
    reviewNotes: text("review_notes").notNull().default(""),
    requestedBy: text("requested_by").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("release_requests_org").on(t.orgId, t.status)],
);
