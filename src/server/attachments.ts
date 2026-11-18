import { isAdmin } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, bookings } from "@/db/schema";
import { bookingScope, findBooking, rememberUser, type Viewer } from "./access";

export const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/tiff",
]);

type UploadResult =
  | { status: 201; id: string }
  | { status: 404 | 413 | 415 | 400; error: string };

export async function uploadAttachment(
  user: Viewer,
  bookingId: string,
  file: File | null,
): Promise<UploadResult> {
  const booking = await findBooking(user, bookingId);
  if (!booking) return { status: 404, error: "Booking not found" };
  if (!file || !file.name) return { status: 400, error: "Choose a file" };
  if (file.size > MAX_BYTES)
    return { status: 413, error: "Files can be up to 20 MB" };
  if (!TYPES.has(file.type))
    return { status: 415, error: "Upload a PDF or an image" };
  await rememberUser(user);
  const id = crypto.randomUUID();
  const objectKey = `bookings/${booking.id}/${id}`;
  await env.files.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  await db.insert(attachments).values({
    id,
    bookingId: booking.id,
    objectKey,
    name: file.name.slice(0, 200),
    contentType: file.type,
    size: file.size,
    uploadedBy: user.id,
  });
  return { status: 201, id };
}

/** The attachment, when its booking is one this person may open. */
async function findAttachment(user: Viewer, id: string) {
  const [row] = await db
    .select({ attachment: attachments })
    .from(attachments)
    .innerJoin(bookings, eq(bookings.id, attachments.bookingId))
    .where(and(eq(attachments.id, id), bookingScope(user)));
  return row?.attachment ?? null;
}

export async function downloadAttachment(
  user: Viewer,
  id: string,
): Promise<Response> {
  const attachment = await findAttachment(user, id);
  const object = attachment ? await env.files.get(attachment.objectKey) : null;
  if (!attachment || !object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": attachment.contentType,
      "content-length": String(attachment.size),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}

/** The uploader or an admin may delete a file. */
export async function deleteAttachment(
  user: Viewer,
  id: string,
): Promise<Response> {
  const attachment = await findAttachment(user, id);
  if (!attachment) return new Response("Not found", { status: 404 });
  if (attachment.uploadedBy !== user.id && !isAdmin(user)) {
    return new Response("Only the uploader or an admin can delete this file", {
      status: 403,
    });
  }
  await db.delete(attachments).where(eq(attachments.id, id));
  await env.files.delete(attachment.objectKey);
  return new Response(null, { status: 204 });
}
