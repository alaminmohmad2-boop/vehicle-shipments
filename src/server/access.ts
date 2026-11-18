import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, counters, users } from "@/db/schema";

export type Viewer = EveryAppUser;

/** Records the person on first sight, and keeps their email current. */
export async function rememberUser(user: Viewer): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, orgId: user.orgId, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}

/**
 * Which bookings a person may open: their own, or every booking of their
 * organization when the Gateway says they're an owner or admin.
 */
export function bookingScope(user: Viewer) {
  const org = eq(bookings.orgId, user.orgId);
  return isAdmin(user) ? org : and(org, eq(bookings.ownerId, user.id))!;
}

/** The booking when this person may open it, else null. */
export async function findBooking(user: Viewer, id: string) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), bookingScope(user)));
  return booking ?? null;
}

export async function requireBooking(user: Viewer, id: string) {
  const booking = await findBooking(user, id);
  if (!booking) throw new Error("Booking not found");
  return booking;
}

/** The next number in an organization's sequence, in one statement. */
export async function nextNumber(orgId: string, name: string): Promise<number> {
  const [row] = await db
    .insert(counters)
    .values({ orgId, name, value: 1 })
    .onConflictDoUpdate({
      target: [counters.orgId, counters.name],
      set: { value: sql`${counters.value} + 1` },
    })
    .returning({ value: counters.value });
  return row!.value;
}

export const formatNumber = (prefix: string, n: number) =>
  `${prefix}-${String(n).padStart(6, "0")}`;

export function requireAdmin(user: Viewer): void {
  if (!isAdmin(user)) throw new Error("Only owners and admins can do this");
}
