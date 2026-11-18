import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, legs, statusEvents, vehicles } from "@/db/schema";
import { requireBooking, type Viewer } from "./access";

/** 24 random bytes, base64url: unguessable, and a new one on every call. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Turns the link on, or replaces it so the old one stops working. */
export async function renewTrackingLink(user: Viewer, bookingId: string) {
  await requireBooking(user, bookingId);
  const token = newToken();
  await db
    .update(bookings)
    .set({ trackingToken: token })
    .where(eq(bookings.id, bookingId));
  return { token };
}

export async function revokeTrackingLink(user: Viewer, bookingId: string) {
  await requireBooking(user, bookingId);
  await db
    .update(bookings)
    .set({ trackingToken: null })
    .where(eq(bookings.id, bookingId));
  return { ok: true };
}

/**
 * What anyone holding the token sees: the booking number, route, milestones
 * and vehicles. Never customers, prices, notes, files or the owner.
 */
export async function getTracking(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [booking] = await db
    .select({
      id: bookings.id,
      number: bookings.number,
      status: bookings.status,
      carrier: bookings.carrier,
      vessel: bookings.vessel,
      voyage: bookings.voyage,
    })
    .from(bookings)
    .where(and(eq(bookings.trackingToken, token)));
  if (!booking) return null;
  const [route, events, units] = await Promise.all([
    db
      .select({
        fromPort: legs.fromPort,
        toPort: legs.toPort,
        vesselVoyage: legs.vesselVoyage,
        etd: legs.etd,
        eta: legs.eta,
      })
      .from(legs)
      .where(eq(legs.bookingId, booking.id))
      .orderBy(asc(legs.position)),
    db
      .select({
        status: statusEvents.status,
        occurredAt: statusEvents.occurredAt,
        location: statusEvents.location,
      })
      .from(statusEvents)
      .where(eq(statusEvents.bookingId, booking.id))
      .orderBy(desc(statusEvents.occurredAt), desc(sql`rowid`)),
    db
      .select({
        vin: vehicles.vin,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        status: vehicles.status,
      })
      .from(vehicles)
      .where(eq(vehicles.bookingId, booking.id))
      .orderBy(asc(vehicles.createdAt), asc(sql`rowid`)),
  ]);
  const { id: _id, ...shown } = booking;
  return {
    booking: shown,
    legs: route,
    events,
    vehicles: units.map((unit) => ({
      ...unit,
      status: unit.status ?? booking.status,
    })),
  };
}
