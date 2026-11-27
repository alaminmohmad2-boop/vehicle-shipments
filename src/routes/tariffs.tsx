import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
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
  amountInput,
  BASES,
  BASIS_LABELS,
  currencyInput,
  fieldErrors,
  formatMoney,
  type Basis,
} from "@/lib/shipping";
import {
  deleteTariff,
  getTariffs,
  saveTariff,
} from "@/serverFunctions/billing";
import { CurrencyList } from "@/client/components/CurrencyList";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/tariffs")({
  loader: () => getTariffs(),
  head: () => ({ meta: [{ title: "Tariffs · Vehicle Shipments" }] }),
  component: Tariffs,
});

type Tariff = Awaited<ReturnType<typeof getTariffs>>["tariffs"][number];

function Tariffs() {
  const { tariffs, canEdit } = Route.useLoaderData();
  const [editing, setEditing] = useState<Tariff | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tariff | null>(null);
  const { run, pending } = useAction();
  return (
    <AppShell wide>
      <PageHeader
        title={t("Tariffs")}
        description={
          canEdit ? undefined : "Only owners and admins can change these."
        }
        actions={
          canEdit ? (
            <Button onClick={() => setEditing("new")}>
              <Plus data-icon="inline-start" />
              {t("New tariff")}
            </Button>
          ) : null
        }
      />
      {tariffs.length === 0 ? (
        <EmptyState title={t("No tariffs yet")} />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Charge")}</TableHead>
                <TableHead>{t("Basis")}</TableHead>
                <TableHead className="text-end">{t("Amount")}</TableHead>
                <TableHead>{t("Carrier")}</TableHead>
                <TableHead>{t("Origin")}</TableHead>
                <TableHead>{t("Destination")}</TableHead>
                {canEdit ? (
                  <TableHead>
                    <span className="sr-only">{t("Actions")}</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.map((tariff) => (
                <TableRow key={tariff.id} data-testid="tariff-row">
                  <TableCell className="font-medium">{tariff.name}</TableCell>
                  <TableCell>
                    {BASIS_LABELS[tariff.basis as Basis] ?? tariff.basis}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMoney(tariff.amountMinor, tariff.currency)}
                  </TableCell>
                  <TableCell>{tariff.carrier || "Any"}</TableCell>
                  <TableCell>{tariff.originPort || "Any"}</TableCell>
                  <TableCell>{tariff.destinationPort || "Any"}</TableCell>
                  {canEdit ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(tariff)}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(tariff)}
                        >
                          {t("Delete")}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing ? (
        <TariffDialog
          tariff={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel={t("Delete tariff")}
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteTariff({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          {t("Charges already added to bookings stay.")}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

const tariffForm = z.object({
  name: z.string().trim().min(1, "Enter a charge name"),
  amount: amountInput,
  currency: currencyInput,
});

function TariffDialog({
  tariff,
  onClose,
}: {
  tariff: Tariff | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    name: tariff?.name ?? "",
    basis: (tariff?.basis ?? "per_unit") as Basis,
    amount: tariff ? (tariff.amountMinor / 100).toFixed(2) : "",
    currency: tariff?.currency ?? "",
    carrier: tariff?.carrier ?? "",
    originPort: tariff?.originPort ?? "",
    destinationPort: tariff?.destinationPort ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const bind = (key: Exclude<keyof typeof values, "basis">) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues({ ...values, [key]: event.target.value }),
  });
  return (
    <FormDialog
      title={tariff ? "Edit tariff" : "New tariff"}
      submitLabel={t("Save tariff")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const parsed = tariffForm.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        const done = await run(() =>
          saveTariff({ data: { ...values, id: tariff?.id } }),
        );
        if (done) onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("Charge name")}
          error={errors.name}
          className="sm:col-span-2"
        >
          <Input {...bind("name")} placeholder={t("Ocean freight")} />
        </Field>
        <Field label={t("Basis")}>
          <NativeSelect
            value={values.basis}
            onChange={(event) =>
              setValues({ ...values, basis: event.target.value as Basis })
            }
          >
            {BASES.map((basis) => (
              <NativeSelectOption key={basis} value={basis}>
                {BASIS_LABELS[basis]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Amount")} error={errors.amount}>
            <Input {...bind("amount")} inputMode="decimal" />
          </Field>
          <CurrencyList />
          <Field label={t("Currency")} error={errors.currency}>
            <Input
              {...bind("currency")}
              className="uppercase"
              maxLength={3}
              list="currency-codes"
              placeholder={t("USD")}
            />
          </Field>
        </div>
        <Field label={t("Carrier")}>
          <Input {...bind("carrier")} placeholder={t("Any")} />
        </Field>
        <Field label={t("Origin port")}>
          <Input {...bind("originPort")} placeholder={t("Any")} />
        </Field>
        <Field label={t("Destination port")}>
          <Input {...bind("destinationPort")} placeholder={t("Any")} />
        </Field>
      </div>
    </FormDialog>
  );
}
