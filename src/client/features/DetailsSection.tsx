import { Pencil } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { Button } from "@/client/components/ui/button";
import { useAction } from "@/client/hooks/useAction";
import { bookingFields, fieldErrors } from "@/lib/shipping";
import { updateBooking } from "@/serverFunctions/bookings";
import { BookingFieldset, type BookingValues } from "./BookingFields";
import { Section } from "./Section";
import type { BookingData } from "./types";

export function DetailsSection({ data }: { data: BookingData }) {
  const { booking } = data;
  const [editing, setEditing] = useState(false);
  const rows: [string, string][] = [
    ["Customer", booking.customerName],
    ["Customer email", booking.customerEmail],
    ["Consignee", booking.consignee],
    ["Carrier", booking.carrier],
    ["Vessel", booking.vessel],
    ["Voyage", booking.voyage],
    ["Cargo notes", booking.cargoNotes],
  ];
  if (data.isAdmin && booking.owner) rows.push(["Created by", booking.owner]);
  return (
    <Section
      title="Details"
      actions={
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil data-icon="inline-start" />
          Edit details
        </Button>
      }
    >
      <dl
        data-testid="booking-details"
        className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2"
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={label === "Cargo notes" ? "sm:col-span-2" : undefined}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words whitespace-pre-wrap">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {editing ? (
        <EditDetails data={data} onClose={() => setEditing(false)} />
      ) : null}
    </Section>
  );
}

function EditDetails({
  data,
  onClose,
}: {
  data: BookingData;
  onClose: () => void;
}) {
  const { booking } = data;
  const [values, setValues] = useState<BookingValues>({
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    consignee: booking.consignee,
    carrier: booking.carrier,
    vessel: booking.vessel,
    voyage: booking.voyage,
    cargoNotes: booking.cargoNotes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  return (
    <FormDialog
      title="Edit details"
      submitLabel="Save details"
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const parsed = bookingFields.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        const done = await run(() =>
          updateBooking({ data: { ...values, id: booking.id } }),
        );
        if (done) onClose();
      }}
    >
      <BookingFieldset values={values} errors={errors} onChange={setValues} />
    </FormDialog>
  );
}
