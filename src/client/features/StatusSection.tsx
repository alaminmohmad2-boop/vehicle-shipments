import { useState, type FormEvent } from "react";
import { Field } from "@/client/components/Field";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/client/components/ui/native-select";
import { useAction } from "@/client/hooks/useAction";
import { formatDateTime } from "@/client/lib/format";
import { STATUSES, STATUS_LABELS, type Status } from "@/lib/shipping";
import { recordStatus } from "@/serverFunctions/bookings";
import { Section } from "./Section";
import type { BookingData } from "./types";

const next = (status: string): Status => {
  const index = STATUSES.indexOf(status as Status);
  return (
    STATUSES[Math.min(index + 1, STATUSES.indexOf("delivered"))] ?? "booked"
  );
};

export function StatusSection({ data }: { data: BookingData }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    status: next(data.booking.status),
    occurredAt: "",
    location: "",
    note: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const done = await run(() =>
      recordStatus({ data: { ...form, bookingId: data.booking.id } }),
    );
    if (done)
      setForm({
        status: next(form.status),
        occurredAt: "",
        location: "",
        note: "",
      });
  }

  return (
    <Section title="Status">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
      >
        <Field label="Status">
          <NativeSelect
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as Status })
            }
          >
            {STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date and time">
          <Input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(event) =>
              setForm({ ...form, occurredAt: event.target.value })
            }
          />
        </Field>
        <Field label="Location">
          <Input
            value={form.location}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value })
            }
          />
        </Field>
        <Field label="Note">
          <Input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" pending={pending}>
            Record status
          </Button>
        </div>
      </form>
      <ol className="space-y-3 border-l border-border pl-4">
        {data.events.map((event) => (
          <li key={event.id} data-testid="status-event" className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={event.status} />
              <span className="text-sm text-muted-foreground">
                {formatDateTime(event.occurredAt)}
                {event.location ? ` · ${event.location}` : ""}
              </span>
            </div>
            {event.note ? <p className="text-sm">{event.note}</p> : null}
            {event.by ? (
              <p className="text-xs text-muted-foreground">{event.by}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
