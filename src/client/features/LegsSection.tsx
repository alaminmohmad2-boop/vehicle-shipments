import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormDialog } from "@/client/components/FormDialog";
import { Button } from "@/client/components/ui/button";
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
import { formatDate } from "@/client/lib/format";
import { fieldErrors, legInput } from "@/lib/shipping";
import { moveLeg, removeLeg, saveLeg } from "@/serverFunctions/bookings";
import { emptyLeg, LegFieldset, type LegValues } from "./BookingFields";
import { Section } from "./Section";
import type { BookingData } from "./types";
import { t } from "@/lib/i18n";

type Leg = BookingData["legs"][number];

export function LegsSection({ data }: { data: BookingData }) {
  const [editing, setEditing] = useState<Leg | "new" | null>(null);
  const [removing, setRemoving] = useState<Leg | null>(null);
  const { run, pending } = useAction();
  const bookingId = data.booking.id;
  const last = data.legs.at(-1);
  return (
    <Section
      title={t("Route")}
      actions={
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          {t("Add leg")}
        </Button>
      }
    >
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("From")}</TableHead>
              <TableHead>{t("To")}</TableHead>
              <TableHead>{t("Vessel / voyage")}</TableHead>
              <TableHead>{t("ETD")}</TableHead>
              <TableHead>{t("ETA")}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t("Actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.legs.map((leg, index) => (
              <TableRow key={leg.id} data-testid="leg-row">
                <TableCell className="text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>{leg.fromPort}</TableCell>
                <TableCell>{leg.toPort}</TableCell>
                <TableCell>{leg.vesselVoyage}</TableCell>
                <TableCell>{formatDate(leg.etd)}</TableCell>
                <TableCell>{formatDate(leg.eta)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Move up")}
                      disabled={index === 0 || pending}
                      onClick={() =>
                        run(() =>
                          moveLeg({
                            data: { bookingId, id: leg.id, direction: "up" },
                          }),
                        )
                      }
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Move down")}
                      disabled={index === data.legs.length - 1 || pending}
                      onClick={() =>
                        run(() =>
                          moveLeg({
                            data: { bookingId, id: leg.id, direction: "down" },
                          }),
                        )
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(leg)}
                    >
                      {t("Edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={data.legs.length <= 1}
                      onClick={() => setRemoving(leg)}
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
      {editing ? (
        <LegDialog
          bookingId={bookingId}
          leg={editing === "new" ? null : editing}
          initial={
            editing === "new"
              ? {
                  ...emptyLeg,
                  fromPort: last?.toPort ?? "",
                  vesselVoyage: last?.vesselVoyage ?? "",
                }
              : {
                  fromPort: editing.fromPort,
                  toPort: editing.toPort,
                  vesselVoyage: editing.vesselVoyage,
                  etd: editing.etd ?? "",
                  eta: editing.eta ?? "",
                }
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove the leg ${removing.fromPort} → ${removing.toPort}?`}
          confirmLabel={t("Remove leg")}
          destructive
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await run(() =>
              removeLeg({ data: { bookingId, id: removing.id } }),
            );
            setRemoving(null);
          }}
        />
      ) : null}
    </Section>
  );
}

function LegDialog({
  bookingId,
  leg,
  initial,
  onClose,
}: {
  bookingId: string;
  leg: Leg | null;
  initial: LegValues;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  return (
    <FormDialog
      title={leg ? "Edit leg" : "Add leg"}
      submitLabel={t("Save leg")}
      pending={pending}
      onClose={onClose}
      onSubmit={async () => {
        const parsed = legInput.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        const done = await run(() =>
          saveLeg({ data: { ...values, bookingId, id: leg?.id } }),
        );
        if (done) onClose();
      }}
    >
      <LegFieldset values={values} errors={errors} onChange={setValues} />
    </FormDialog>
  );
}
