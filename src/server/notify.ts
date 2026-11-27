import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { STATUS_LABELS, type Status } from "@/lib/shipping";

// Customer notifications at each stage, through a pluggable provider.
//
// A provider is an object with a name and a send function. Two are built in
// and neither is paid:
//   "log"     (default) sends nothing; the message is only recorded.
//   "webhook" POSTs the message as JSON to NOTIFY_WEBHOOK_URL, for any
//             service the owner connects later (email, SMS, WhatsApp bridge).
// Choose with the NOTIFY_PROVIDER variable. To add another, implement
// NotificationProvider and register it in `providers` below.

export interface Message {
  to: string;
  subject: string;
  body: string;
  bookingNumber: string;
}
export interface NotificationProvider {
  name: string;
  send(message: Message): Promise<void>;
}

const logProvider: NotificationProvider = {
  name: "log",
  async send() {},
};

const webhookProvider: NotificationProvider = {
  name: "webhook",
  async send(message) {
    const url = (env as unknown as Record<string, string | undefined>)
      .NOTIFY_WEBHOOK_URL;
    if (!url) throw new Error("NOTIFY_WEBHOOK_URL is not set");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`Webhook answered ${response.status}`);
  },
};

const providers: Record<string, NotificationProvider> = {
  log: logProvider,
  webhook: webhookProvider,
};

function activeProvider(): NotificationProvider {
  const name = (env as unknown as Record<string, string | undefined>)
    .NOTIFY_PROVIDER;
  return providers[name ?? "log"] ?? logProvider;
}

/** The text for a milestone, in Arabic and English (the customer's language is not recorded). */
const ARABIC: Record<Status, string> = {
  booked: "تم تأكيد حجز شحنتك",
  documents_ready: "مستندات شحنتك جاهزة",
  customs_cleared: "تم التخليص الجمركي لشحنتك",
  loaded: "تم تحميل شحنتك وهي في الطريق",
  arrived: "وصلت شحنتك إلى ميناء الوصول",
  delivered: "تم تسليم شحنتك",
  cancelled: "تم إلغاء الحجز",
};
const ENGLISH: Record<Status, string> = {
  booked: "Your shipment is booked",
  documents_ready: "Your shipment documents are ready",
  customs_cleared: "Your shipment has cleared customs",
  loaded: "Your shipment is loaded and on its way",
  arrived: "Your shipment has arrived at the destination port",
  delivered: "Your shipment was delivered",
  cancelled: "Your booking was cancelled",
};

export function buildMessage(input: {
  to: string;
  bookingNumber: string;
  status: Status;
  location: string;
  trackingUrl: string | null;
}): Message {
  const place = input.location ? ` (${input.location})` : "";
  const link = input.trackingUrl ? `\n${input.trackingUrl}` : "";
  return {
    to: input.to,
    bookingNumber: input.bookingNumber,
    subject: `${input.bookingNumber}: ${ENGLISH[input.status]}`,
    body:
      `${ARABIC[input.status]}${place}\n` +
      `${ENGLISH[input.status]}${place}\n` +
      `${input.bookingNumber} · ${STATUS_LABELS[input.status]}${link}`,
  };
}

/** Records the message and hands it to the provider. Never throws: a failed send must not block a status change. */
export async function notifyCustomer(
  orgId: string,
  bookingId: string,
  message: Message,
) {
  const provider = activeProvider();
  let state = provider.name === "log" ? "logged" : "sent";
  let error = "";
  try {
    await provider.send(message);
  } catch (e) {
    state = "failed";
    error = e instanceof Error ? e.message : String(e);
  }
  try {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      orgId,
      bookingId,
      recipient: message.to,
      subject: message.subject,
      body: message.body,
      provider: provider.name,
      state,
      error,
    });
  } catch {
    // Recording is best effort too.
  }
}

export async function listNotifications(bookingId: string) {
  return db
    .select({
      id: notifications.id,
      recipient: notifications.recipient,
      subject: notifications.subject,
      body: notifications.body,
      provider: notifications.provider,
      state: notifications.state,
      error: notifications.error,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.bookingId, bookingId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
}
