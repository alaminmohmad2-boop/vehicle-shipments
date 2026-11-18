import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import { useAction } from "@/client/hooks/useAction";
import {
  renewTrackingLink,
  revokeTrackingLink,
} from "@/serverFunctions/bookings";
import { Section } from "./Section";
import type { BookingData } from "./types";

export function TrackingSection({ data }: { data: BookingData }) {
  const { run, pending } = useAction();
  const id = data.booking.id;
  return (
    <Section title="Tracking link">
      {data.trackingUrl ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <code
              data-testid="tracking-url"
              className="min-w-0 flex-1 truncate text-sm"
            >
              {data.trackingUrl}
            </code>
            <CopyButton value={data.trackingUrl} successMessage="Link copied" />
          </div>
          <p className="text-sm text-muted-foreground">
            Anyone with the link sees the route, milestones and vehicles, but no
            prices, files, notes or customer details.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => renewTrackingLink({ data: { id } }))}
            >
              New link
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => revokeTrackingLink({ data: { id } }))}
            >
              Turn off link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Either one stops the current link working.
          </p>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          pending={pending}
          onClick={() => run(() => renewTrackingLink({ data: { id } }))}
        >
          Create tracking link
        </Button>
      )}
    </Section>
  );
}
