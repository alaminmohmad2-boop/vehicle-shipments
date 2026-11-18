import { Field } from "@/client/components/Field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import type { BookingFields as Values } from "@/lib/shipping";

export type BookingValues = Required<Values>;

export const emptyBooking: BookingValues = {
  customerName: "",
  customerEmail: "",
  consignee: "",
  carrier: "",
  vessel: "",
  voyage: "",
  cargoNotes: "",
};

/** The booking's own fields, shared by the new-booking form and the edit dialog. */
export function BookingFieldset({
  values,
  errors,
  onChange,
}: {
  values: BookingValues;
  errors: Record<string, string>;
  onChange: (values: BookingValues) => void;
}) {
  const bind = (key: keyof BookingValues) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...values, [key]: event.target.value }),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Customer name" error={errors.customerName}>
        <Input {...bind("customerName")} autoComplete="organization" />
      </Field>
      <Field label="Customer email" error={errors.customerEmail}>
        <Input {...bind("customerEmail")} type="email" autoComplete="email" />
      </Field>
      <Field label="Consignee" error={errors.consignee}>
        <Input {...bind("consignee")} />
      </Field>
      <Field label="Carrier" error={errors.carrier}>
        <Input {...bind("carrier")} />
      </Field>
      <Field label="Vessel" error={errors.vessel}>
        <Input {...bind("vessel")} />
      </Field>
      <Field label="Voyage" error={errors.voyage}>
        <Input {...bind("voyage")} />
      </Field>
      <Field
        label="Cargo notes"
        error={errors.cargoNotes}
        className="sm:col-span-2"
      >
        <Textarea {...bind("cargoNotes")} rows={3} />
      </Field>
    </div>
  );
}

export type LegValues = {
  fromPort: string;
  toPort: string;
  vesselVoyage: string;
  etd: string;
  eta: string;
};
export const emptyLeg: LegValues = {
  fromPort: "",
  toPort: "",
  vesselVoyage: "",
  etd: "",
  eta: "",
};

/** One leg's fields; `prefix` picks its errors out of the form's. */
export function LegFieldset({
  values,
  errors,
  prefix = "",
  onChange,
}: {
  values: LegValues;
  errors: Record<string, string>;
  prefix?: string;
  onChange: (values: LegValues) => void;
}) {
  const bind = (key: keyof LegValues) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...values, [key]: event.target.value }),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="From port" error={errors[`${prefix}fromPort`]}>
        <Input {...bind("fromPort")} />
      </Field>
      <Field label="To port" error={errors[`${prefix}toPort`]}>
        <Input {...bind("toPort")} />
      </Field>
      <Field
        label="Vessel / voyage"
        error={errors[`${prefix}vesselVoyage`]}
        className="sm:col-span-2"
      >
        <Input {...bind("vesselVoyage")} />
      </Field>
      <Field label="ETD" error={errors[`${prefix}etd`]}>
        <Input {...bind("etd")} type="date" />
      </Field>
      <Field label="ETA" error={errors[`${prefix}eta`]}>
        <Input {...bind("eta")} type="date" />
      </Field>
    </div>
  );
}
