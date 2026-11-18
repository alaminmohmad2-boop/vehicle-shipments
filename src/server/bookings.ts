import { isAdmin } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  attachments,
  bookings,
  legs,
  statusEvents,
  users,
  vehicles,
} from "@/db/schema";
import {
  bookingFields,
  createBookingInput,
  legInput,
  LOCKED_STATUSES,
  STATUSES,
  vehicleInput,
  type Status,
} from "@/lib/shipping";
import {
  bookingScope,
  formatNumber,
  nextNumber,
  rememberUser,
  requireBooking,
  type Viewer,
} from "./access";

const id = z.string().uuid();
const nowMinute = () => new Date().toISOString().slice(0, 16);

// ---- Bookings ----

export async function createBooking(
  user: Viewer,
  input: z.output<typeof createBookingInput>,
): Promise<{ id: string }> {
  await rememberUser(user);
  const number = formatNumber("BK", await nextNumber(user.orgId, "booking"));
  const bookingId = crypto.randomUUID();
  const { legs: route, ...fields } = input;
  await db.batch([
    db.insert(bookings).values({
      id: bookingId,
      orgId: user.orgId,
      ownerId: user.id,
      number,
      ...fields,
    }),
    db.insert(legs).values(
      route.map((leg, position) => ({
        id: crypto.randomUUID(),
        bookingId,
        position,
        ...leg,
        etd: leg.etd || null,
        eta: leg.eta || null,
      })),
    ),
    db.insert(statusEvents).values({
      id: crypto.randomUUID(),
      bookingId,
      status: "booked",
      occurredAt: nowMinute(),
      createdBy: user.id,
    }),
  ]);
  return { id: bookingId };
}

export const updateBookingInput = bookingFields.extend({ id });

export async function updateBooking(
  user: Viewer,
  { id: bookingId, ...fields }: z.output<typeof updateBookingInput>,
) {
  await requireBooking(user, bookingId);
  await db.update(bookings).set(fields).where(eq(bookings.id, bookingId));
  return { ok: true };
}

export async function deleteBooking(user: Viewer, bookingId: string) {
  await requireBooking(user, bookingId);
  const files = await db
    .select({ key: attachments.objectKey })
    .from(attachments)
    .where(eq(attachments.bookingId, bookingId));
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  if (files.length) await env.files.delete(files.map((file) => file.key));
  return { ok: true };
}

/** Everything the booking page shows, or null when this person may not open it. */
export async function getBooking(user: Viewer, bookingId: string) {
  const booking = await requireBooking(user, bookingId).catch(() => null);
  if (!booking) return null;
  const [route, units, events, files, owner] = await Promise.all([
    db
      .select()
      .from(legs)
      .where(eq(legs.bookingId, bookingId))
      .orderBy(asc(legs.position)),
    db
      .select()
      .from(vehicles)
      .where(eq(vehicles.bookingId, bookingId))
      .orderBy(asc(vehicles.createdAt), asc(sql`rowid`)),
    db
      .select({
        id: statusEvents.id,
        status: statusEvents.status,
        occurredAt: statusEvents.occurredAt,
        location: statusEvents.location,
        note: statusEvents.note,
        by: users.email,
      })
      .from(statusEvents)
      .leftJoin(users, eq(users.id, statusEvents.createdBy))
      .where(eq(statusEvents.bookingId, bookingId))
      .orderBy(desc(statusEvents.occurredAt), desc(sql`${statusEvents}.rowid`)),
    db
      .select({
        id: attachments.id,
        name: attachments.name,
        contentType: attachments.contentType,
        size: attachments.size,
        uploadedBy: attachments.uploadedBy,
        uploader: users.email,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.uploadedBy))
      .where(eq(attachments.bookingId, bookingId))
      .orderBy(desc(attachments.createdAt)),
    db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, booking.ownerId)),
  ]);
  const { trackingToken, ...rest } = booking;
  return {
    booking: {
      ...rest,
      owner: owner[0]?.email ?? null,
      hasTracking: trackingToken !== null,
    },
    trackingToken,
    legs: route,
    vehicles: units,
    events,
    attachments: files.map((file) => ({
      ...file,
      canDelete: file.uploadedBy === user.id || isAdmin(user),
    })),
  };
}

// ---- Legs ----

export const saveLegInput = legInput.extend({
  bookingId: id,
  id: id.optional(),
});

export async function saveLeg(
  user: Viewer,
  input: z.output<typeof saveLegInput>,
) {
  await requireBooking(user, input.bookingId);
  const values = {
    fromPort: input.fromPort,
    toPort: input.toPort,
    vesselVoyage: input.vesselVoyage,
    etd: input.etd || null,
    eta: input.eta || null,
  };
  if (input.id) {
    await db
      .update(legs)
      .set(values)
      .where(and(eq(legs.id, input.id), eq(legs.bookingId, input.bookingId)));
  } else {
    await db.insert(legs).values({
      id: crypto.randomUUID(),
      bookingId: input.bookingId,
      position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM legs WHERE booking_id = ${input.bookingId})`,
      ...values,
    });
  }
  return { ok: true };
}

export const legRef = z.object({ bookingId: id, id });

export async function removeLeg(
  user: Viewer,
  { bookingId, id: legId }: z.output<typeof legRef>,
) {
  await requireBooking(user, bookingId);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(legs)
    .where(eq(legs.bookingId, bookingId));
  if (count <= 1) throw new Error("A booking keeps at least one leg");
  await db
    .delete(legs)
    .where(and(eq(legs.id, legId), eq(legs.bookingId, bookingId)));
  return { ok: true };
}

export const moveLegInput = legRef.extend({
  direction: z.enum(["up", "down"]),
});

export async function moveLeg(
  user: Viewer,
  input: z.output<typeof moveLegInput>,
) {
  await requireBooking(user, input.bookingId);
  const route = await db
    .select({ id: legs.id, position: legs.position })
    .from(legs)
    .where(eq(legs.bookingId, input.bookingId))
    .orderBy(asc(legs.position));
  const index = route.findIndex((leg) => leg.id === input.id);
  const other = route[input.direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !other) return { ok: true };
  const leg = route[index]!;
  await db.batch([
    db
      .update(legs)
      .set({ position: other.position })
      .where(eq(legs.id, leg.id)),
    db
      .update(legs)
      .set({ position: leg.position })
      .where(eq(legs.id, other.id)),
  ]);
  return { ok: true };
}

// ---- Vehicles ----

export const saveVehicleInput = vehicleInput.extend({
  bookingId: id,
  id: id.optional(),
});

type VehicleResult =
  | { ok: true }
  | { ok: false; field: string; message: string };

export async function saveVehicle(
  user: Viewer,
  input: z.output<typeof saveVehicleInput>,
): Promise<VehicleResult> {
  const booking = await requireBooking(user, input.bookingId);
  if (LOCKED_STATUSES.includes(booking.status as Status)) {
    return {
      ok: false,
      field: "form",
      message: "Reopen the booking to change its vehicles",
    };
  }
  const { bookingId, id: vehicleId, ...values } = input;
  const [clash] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(
      and(eq(vehicles.bookingId, bookingId), eq(vehicles.vin, values.vin)),
    );
  if (clash && clash.id !== vehicleId) {
    return {
      ok: false,
      field: "vin",
      message: "This VIN is already on the booking",
    };
  }
  if (vehicleId) {
    await db
      .update(vehicles)
      .set(values)
      .where(
        and(eq(vehicles.id, vehicleId), eq(vehicles.bookingId, bookingId)),
      );
  } else {
    await db
      .insert(vehicles)
      .values({ id: crypto.randomUUID(), bookingId, ...values });
  }
  return { ok: true };
}

export const vehicleRef = z.object({ bookingId: id, id });

export async function removeVehicle(
  user: Viewer,
  { bookingId, id: vehicleId }: z.output<typeof vehicleRef>,
) {
  const booking = await requireBooking(user, bookingId);
  if (LOCKED_STATUSES.includes(booking.status as Status)) {
    throw new Error("Reopen the booking to change its vehicles");
  }
  await db
    .delete(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.bookingId, bookingId)));
  return { ok: true };
}

// ---- Status ----

export const recordStatusInput = z.object({
  bookingId: id,
  status: z.enum(STATUSES),
  occurredAt: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Enter a date and time"),
  location: z.string().trim().max(120).default(""),
  note: z.string().trim().max(1000).default(""),
});

/** The current status is the one recorded last, whatever time it was given. */
const latestStatus = (bookingId: string) =>
  sql`(SELECT status FROM status_events WHERE booking_id = ${bookingId} ORDER BY rowid DESC LIMIT 1)`;

async function addEvent(
  user: Viewer,
  bookingId: string,
  event: { status: Status; occurredAt: string; location: string; note: string },
) {
  await rememberUser(user);
  await db.batch([
    db
      .insert(statusEvents)
      .values({
        id: crypto.randomUUID(),
        bookingId,
        createdBy: user.id,
        ...event,
      }),
    db
      .update(bookings)
      .set({ status: latestStatus(bookingId) })
      .where(eq(bookings.id, bookingId)),
  ]);
}

export async function recordStatus(
  user: Viewer,
  input: z.output<typeof recordStatusInput>,
) {
  await requireBooking(user, input.bookingId);
  await addEvent(user, input.bookingId, {
    status: input.status,
    occurredAt: input.occurredAt || nowMinute(),
    location: input.location,
    note: input.note,
  });
  return { ok: true };
}

/** Back to the last open milestone, recorded as a new event. */
export async function reopenBooking(user: Viewer, bookingId: string) {
  const booking = await requireBooking(user, bookingId);
  if (!LOCKED_STATUSES.includes(booking.status as Status)) return { ok: true };
  const history = await db
    .select({
      status: statusEvents.status,
      occurredAt: statusEvents.occurredAt,
    })
    .from(statusEvents)
    .where(eq(statusEvents.bookingId, bookingId))
    .orderBy(desc(sql`rowid`));
  const previous = history.find(
    (event) => !LOCKED_STATUSES.includes(event.status as Status),
  );
  await addEvent(user, bookingId, {
    status: (previous?.status as Status) ?? "booked",
    occurredAt: nowMinute(),
    location: "",
    note: "Reopened",
  });
  return { ok: true };
}

// ---- Finder ----

const SORTS = [
  "number",
  "customer",
  "status",
  "departs",
  "units",
  "created",
] as const;
const PAGE_SIZE = 20;

export const searchInput = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  carrier: z.string().trim().max(120).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sort: z.enum(SORTS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).max(10000).optional(),
});
type SearchInput = z.infer<typeof searchInput>;

// Subqueries name the outer row in full: an unqualified "id" would be their own table's.
const outerId = sql.raw(`"bookings"."id"`);

export async function searchBookings(user: Viewer, input: SearchInput) {
  await rememberUser(user);
  const origin = sql<
    string | null
  >`(SELECT from_port FROM legs WHERE booking_id = ${outerId} ORDER BY position ASC LIMIT 1)`;
  const destination = sql<
    string | null
  >`(SELECT to_port FROM legs WHERE booking_id = ${outerId} ORDER BY position DESC LIMIT 1)`;
  const departs = sql<
    string | null
  >`(SELECT etd FROM legs WHERE booking_id = ${outerId} ORDER BY position ASC LIMIT 1)`;
  const units = sql<number>`(SELECT count(*) FROM vehicles WHERE booking_id = ${outerId})`;

  const where: SQL[] = [bookingScope(user)];
  if (input.q) {
    const like = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(
      ${bookings.number} LIKE ${like} ESCAPE '\\'
      OR ${bookings.customerName} LIKE ${like} ESCAPE '\\'
      OR ${bookings.vessel} LIKE ${like} ESCAPE '\\'
      OR ${bookings.voyage} LIKE ${like} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM vehicles v WHERE v.booking_id = ${outerId} AND v.vin LIKE ${like.toUpperCase()} ESCAPE '\\')
      OR EXISTS (SELECT 1 FROM legs l WHERE l.booking_id = ${outerId} AND (l.from_port LIKE ${like} ESCAPE '\\' OR l.to_port LIKE ${like} ESCAPE '\\' OR l.vessel_voyage LIKE ${like} ESCAPE '\\'))
    )`);
  }
  if (input.status) where.push(eq(bookings.status, input.status));
  if (input.carrier) where.push(eq(bookings.carrier, input.carrier));
  if (input.from) where.push(sql`${departs} >= ${input.from}`);
  if (input.to) where.push(sql`${departs} <= ${input.to}`);
  const filter = and(...where);

  const dir = input.dir === "asc" ? asc : desc;
  const order = {
    number: [dir(bookings.number)],
    customer: [
      dir(sql`${bookings.customerName} COLLATE NOCASE`),
      desc(bookings.number),
    ],
    status: [dir(bookings.status), desc(bookings.number)],
    departs: [dir(departs), desc(bookings.number)],
    units: [dir(units), desc(bookings.number)],
    created: [dir(bookings.createdAt), dir(bookings.number)],
  }[input.sort ?? "created"];
  const page = input.page ?? 1;

  const [rows, [{ total }], carriers] = await Promise.all([
    db
      .select({
        id: bookings.id,
        number: bookings.number,
        customerName: bookings.customerName,
        carrier: bookings.carrier,
        vessel: bookings.vessel,
        voyage: bookings.voyage,
        status: bookings.status,
        origin,
        destination,
        departs,
        units,
      })
      .from(bookings)
      .where(filter)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(bookings)
      .where(filter),
    db
      .selectDistinct({ carrier: bookings.carrier })
      .from(bookings)
      .where(and(bookingScope(user), sql`${bookings.carrier} <> ''`))
      .orderBy(asc(bookings.carrier)),
  ]);
  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    carriers: carriers.map((c) => c.carrier),
  };
}
