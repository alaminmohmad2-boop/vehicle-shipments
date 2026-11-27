import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inspections, releaseRequests, yardEvents, yards } from "@/db/schema";
import { requireAdmin, type Viewer } from "./access";

const text = (max: number) => z.string().trim().max(max).default("");
const vin = z.string().trim().toUpperCase().min(5, "Enter the VIN").max(17);

export const yardInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().toUpperCase().min(1, "Enter a yard code").max(20),
  name: z.string().trim().min(1, "Enter the yard name").max(120),
  city: text(80),
  address: text(200),
  capacity: z.coerce.number().int().min(1).max(100000),
  status: z.enum(["active", "closed"]).default("active"),
});

export const eventInput = z.object({
  yardId: z.string().uuid(),
  vin,
  kind: z.enum(["entry", "exit", "move"]),
  zone: text(40),
  slot: text(40),
  gate: text(40),
  driverName: text(80),
  carrier: text(80),
  truckPlate: text(30),
  sealNumber: text(40),
  notes: text(400),
});

export const inspectionInput = z.object({
  yardId: z.string().uuid().nullable().default(null),
  vin,
  stage: z.enum(["gate_in", "storage", "gate_out"]),
  condition: z.enum(["good", "fair", "damaged"]),
  odometerKm: z.coerce.number().int().min(0).max(5_000_000).nullable(),
  fuelPercent: z.coerce.number().int().min(0).max(100).nullable(),
  damageNotes: text(1000),
});

export const releaseInput = z.object({
  yardId: z.string().uuid().nullable().default(null),
  vin,
  customerName: text(120),
  recipientName: z.string().trim().min(1, "Enter the recipient").max(120),
  recipientId: text(60),
  recipientPhone: text(40),
  pickupDate: text(10),
});

export const reviewInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "released"]),
  reviewNotes: text(400),
});

/** Which VINs are in which yard now, from the latest event of each VIN. */
export async function currentOccupancy(orgId: string) {
  const rows = await db
    .select()
    .from(yardEvents)
    .where(eq(yardEvents.orgId, orgId))
    .orderBy(desc(yardEvents.createdAt), desc(yardEvents.id));
  const seen = new Set<string>();
  const present: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.vin)) continue;
    seen.add(row.vin);
    if (row.kind !== "exit") present.push(row);
  }
  return present;
}

export async function getYardOverview(user: Viewer) {
  const [yardRows, present, events, insp, requests] = await Promise.all([
    db
      .select()
      .from(yards)
      .where(eq(yards.orgId, user.orgId))
      .orderBy(yards.code),
    currentOccupancy(user.orgId),
    db
      .select()
      .from(yardEvents)
      .where(eq(yardEvents.orgId, user.orgId))
      .orderBy(desc(yardEvents.createdAt), desc(yardEvents.id))
      .limit(200),
    db
      .select()
      .from(inspections)
      .where(eq(inspections.orgId, user.orgId))
      .orderBy(desc(inspections.createdAt))
      .limit(200),
    db
      .select()
      .from(releaseRequests)
      .where(eq(releaseRequests.orgId, user.orgId))
      .orderBy(desc(releaseRequests.createdAt))
      .limit(200),
  ]);
  const counts = new Map<string, number>();
  for (const p of present)
    counts.set(p.yardId, (counts.get(p.yardId) ?? 0) + 1);
  return {
    yards: yardRows.map((y) => ({ ...y, occupied: counts.get(y.id) ?? 0 })),
    present,
    events,
    inspections: insp,
    requests,
  };
}

export async function saveYard(
  user: Viewer,
  input: z.output<typeof yardInput>,
) {
  requireAdmin(user);
  const { id, ...values } = input;
  try {
    if (id) {
      await db
        .update(yards)
        .set(values)
        .where(and(eq(yards.id, id), eq(yards.orgId, user.orgId)));
      return { id };
    }
    const newId = crypto.randomUUID();
    await db.insert(yards).values({ id: newId, orgId: user.orgId, ...values });
    return { id: newId };
  } catch {
    throw new Error("A yard with this code already exists");
  }
}

export async function deleteYard(user: Viewer, id: string) {
  requireAdmin(user);
  await db
    .delete(yards)
    .where(and(eq(yards.id, id), eq(yards.orgId, user.orgId)));
  return { ok: true };
}

async function requireYard(user: Viewer, id: string) {
  const [yard] = await db
    .select()
    .from(yards)
    .where(and(eq(yards.id, id), eq(yards.orgId, user.orgId)));
  if (!yard) throw new Error("Yard not found");
  return yard;
}

export async function logEvent(
  user: Viewer,
  input: z.output<typeof eventInput>,
) {
  const yard = await requireYard(user, input.yardId);
  if (yard.status !== "active") throw new Error("This yard is closed");
  const present = await currentOccupancy(user.orgId);
  const where = present.find((p) => p.vin === input.vin);
  if (input.kind === "entry") {
    if (where) throw new Error("This VIN is already inside a yard");
    const inside = present.filter((p) => p.yardId === yard.id).length;
    if (inside >= yard.capacity) throw new Error("The yard is full");
  } else if (!where) {
    throw new Error("This VIN is not inside any yard");
  } else if (input.kind === "exit" && where.yardId !== yard.id) {
    throw new Error("This VIN is in a different yard");
  }
  if (input.kind === "exit") {
    // A vehicle leaves only on an approved release request, if one exists.
    const [req] = await db
      .select()
      .from(releaseRequests)
      .where(
        and(
          eq(releaseRequests.orgId, user.orgId),
          eq(releaseRequests.vin, input.vin),
          sql`${releaseRequests.status} in ('approved')`,
        ),
      );
    if (req) {
      await db
        .update(releaseRequests)
        .set({ status: "released" })
        .where(eq(releaseRequests.id, req.id));
    }
  }
  await db.insert(yardEvents).values({
    id: crypto.randomUUID(),
    orgId: user.orgId,
    actorEmail: user.email,
    ...input,
  });
  return { ok: true };
}

export async function addInspection(
  user: Viewer,
  input: z.output<typeof inspectionInput>,
) {
  if (input.yardId) await requireYard(user, input.yardId);
  await db.insert(inspections).values({
    id: crypto.randomUUID(),
    orgId: user.orgId,
    inspectorEmail: user.email,
    ...input,
  });
  return { ok: true };
}

export async function requestRelease(
  user: Viewer,
  input: z.output<typeof releaseInput>,
) {
  if (input.yardId) await requireYard(user, input.yardId);
  await db.insert(releaseRequests).values({
    id: crypto.randomUUID(),
    orgId: user.orgId,
    requestedBy: user.email,
    ...input,
  });
  return { ok: true };
}

export async function reviewRelease(
  user: Viewer,
  input: z.output<typeof reviewInput>,
) {
  requireAdmin(user);
  await db
    .update(releaseRequests)
    .set({ status: input.status, reviewNotes: input.reviewNotes })
    .where(
      and(
        eq(releaseRequests.id, input.id),
        eq(releaseRequests.orgId, user.orgId),
      ),
    );
  return { ok: true };
}
