import { Lock, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { FormDialog } from "@/client/components/FormDialog";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/client/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { useAction } from "@/client/hooks/useAction";
import {
  fieldErrors,
  LOCKED_STATUSES,
  STATUSES,
  STATUS_LABELS,
  statusLabel,
  vehicleInput,
  type Status,
} from "@/lib/shipping";
import { removeVehicle, saveVehicle } from "@/serverFunctions/bookings";
import { Section } from "./Section";
import type { BookingData } from "./types";
import { lookupVin } from "@/serverFunctions/bookings";
import { t } from "@/lib/i18n";

type Vehicle = BookingData["vehicles"][number];

const dims = (v: Vehicle) =>
  v.lengthCm || v.widthCm || v.heightCm
    ? `${v.lengthCm ?? "?"} × ${v.widthCm ?? "?"} × ${v.heightCm ?? "?"}`
    : "";

export function VehiclesSection({
  data,
  onReopen,
}: {
  data: BookingData;
  onReopen: () => void;
}) {
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const { run, pending } = useAction();
  const locked = LOCKED_STATUSES.includes(data.booking.status as Status);
  const bookingId = data.booking.id;
  return (
    <Section
      title={`Vehicles (${data.vehicles.length})`}
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => setEditing("new")}
        >
          <Plus data-icon="inline-start" />
          {t("Add vehicle")}
        </Button>
      }
    >
      {locked ? (
        <Alert>
          <Lock />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {statusLabel(data.booking.status)}{" "}
              {t("bookings keep their vehicles as they are.")}
            </span>
            <Button size="sm" variant="outline" onClick={onReopen}>
              {t("Reopen")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {data.vehicles.length === 0 ? (
        <EmptyState title={t("No vehicles yet")} size="sm" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("VIN")}</TableHead>
                <TableHead>{t("Vehicle")}</TableHead>
                <TableHead>{t("L × W × H (cm)")}</TableHead>
                <TableHead className="text-end">{t("Weight (kg)")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.vehicles.map((vehicle) => (
                <TableRow key={vehicle.id} data-testid="vehicle-row">
                  <TableCell className="font-mono text-xs">
                    {vehicle.vin}
                  </TableCell>
                  <TableCell>
                    {[vehicle.year, vehicle.make, vehicle.model]
                      .filter(Boolean)
                      .join(" ")}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {dims(vehicle)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {vehicle.weightKg?.toLocaleString("en-US") ?? ""}
                  </TableCell>
                  <TableCell>
                    <span data-testid="vehicle-status">
                      <StatusBadge
                        status={vehicle.status ?? data.booking.status}
                      />
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => setEditing(vehicle)}
                      >
                        {t("Edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => setRemoving(vehicle)}
                      >
                        {t("Remove")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing ? (
        <VehicleDialog
          bookingId={bookingId}
          vehicle={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.vin}?`}
          confirmLabel={t("Remove vehicle")}
          destructive
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await run(() =>
              removeVehicle({ data: { bookingId, id: removing.id } }),
            );
            setRemoving(null);
          }}
        />
      ) : null}
    </Section>
  );
}

const text = (value: number | null | undefined) =>
  value == null ? "" : String(value);

function VehicleDialog({
  bookingId,
  vehicle,
  onClose,
}: {
  bookingId: string;
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    vin: vehicle?.vin ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: text(vehicle?.year),
    lengthCm: text(vehicle?.lengthCm),
    widthCm: text(vehicle?.widthCm),
    heightCm: text(vehicle?.heightCm),
    weightKg: text(vehicle?.weightKg),
    status: vehicle?.status ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const bind = (key: Exclude<keyof typeof values, "status">) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues({ ...values, [key]: event.target.value }),
  });
  const number = { inputMode: "numeric" as const };
  const [decoding, setDecoding] = useState(false);
  const [decodeNote, setDecodeNote] = useState("");
  async function decode() {
    setDecoding(true);
    setDecodeNote("");
    try {
      const result = await lookupVin({ data: { vin: values.vin } });
      if (result.found) {
        setValues({
          ...values,
          vin: values.vin.trim().toUpperCase(),
          make: result.make || values.make,
          model: result.model || values.model,
          year: result.year || values.year,
        });
        setDecodeNote(t("Filled from the free NHTSA VIN database. Check it."));
      } else if (result.reason === "invalid") {
        setDecodeNote(t("Enter all 17 characters of the VIN first."));
      } else if (result.reason === "unknown") {
        setDecodeNote(
          t("This VIN is not in the database. Fill the details by hand."),
        );
      } else {
        setDecodeNote(t("The VIN service could not be reached. Try again."));
      }
    } finally {
      setDecoding(false);
    }
  }
  return (
    <FormDialog
      title={vehicle ? "Edit vehicle" : "Add vehicle"}
      submitLabel={t("Save vehicle")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const input = {
          ...values,
          status: (values.status || null) as Status | null,
        };
        const parsed = vehicleInput.safeParse(input);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        setErrors({});
        const result = await run(() =>
          saveVehicle({ data: { ...input, bookingId, id: vehicle?.id } }),
        );
        if (!result) return;
        if (result.ok) onClose();
        else setErrors({ [result.field]: result.message });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("VIN")} error={errors.vin} className="sm:col-span-2">
          <Input
            {...bind("vin")}
            className="font-mono uppercase"
            maxLength={17}
            autoComplete="off"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            pending={decoding}
            onClick={decode}
          >
            {t("Fill from VIN")}
          </Button>
          {decodeNote ? (
            <span className="text-xs text-muted-foreground">{decodeNote}</span>
          ) : null}
        </div>
        <Field label={t("Make")} error={errors.make}>
          <Input {...bind("make")} />
        </Field>
        <Field label={t("Model")} error={errors.model}>
          <Input {...bind("model")} />
        </Field>
        <Field label={t("Year")} error={errors.year}>
          <Input {...bind("year")} {...number} />
        </Field>
        <Field label={t("Weight (kg)")} error={errors.weightKg}>
          <Input {...bind("weightKg")} {...number} />
        </Field>
        <Field label={t("Length (cm)")} error={errors.lengthCm}>
          <Input {...bind("lengthCm")} {...number} />
        </Field>
        <Field label={t("Width (cm)")} error={errors.widthCm}>
          <Input {...bind("widthCm")} {...number} />
        </Field>
        <Field label={t("Height (cm)")} error={errors.heightCm}>
          <Input {...bind("heightCm")} {...number} />
        </Field>
        <Field label={t("Vehicle status")} error={errors.status}>
          <NativeSelect
            value={values.status}
            onChange={(event) =>
              setValues({ ...values, status: event.target.value })
            }
          >
            <NativeSelectOption value="">
              {t("Same as booking")}
            </NativeSelectOption>
            {STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {errors.form ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}
    </FormDialog>
  );
}
