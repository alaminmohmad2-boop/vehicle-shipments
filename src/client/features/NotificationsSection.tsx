import { formatDateTime } from "@/client/lib/format";
import { t } from "@/lib/i18n";
import { Section } from "./Section";
import type { BookingData } from "./types";

/** Messages prepared for the customer at each milestone. */
export function NotificationsSection({ data }: { data: BookingData }) {
  return (
    <Section title={t("Customer messages")}>
      {data.notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "No messages yet. One is prepared each time a milestone is recorded and the booking has a customer email.",
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.notifications.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{n.recipient}</span>
                <span className="text-muted-foreground">
                  {t(n.state)} · {formatDateTime(n.createdAt.replace(" ", "T"))}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {n.body}
              </p>
              {n.error ? (
                <p className="mt-1 text-destructive">{n.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
