import { Link } from "@tanstack/react-router";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { CurrencyList } from "@/client/components/CurrencyList";
import { Field } from "@/client/components/Field";
import { FormDialog } from "@/client/components/FormDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
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
import {
  amountInput,
  currencyInput,
  fieldErrors,
  formatMoney,
  formatTotals,
  parseAmount,
  parsePercent,
  parseRate,
} from "@/lib/shipping";
import { getCompany } from "@/serverFunctions/settings";
import {
  addCharge,
  applyTariffs,
  issueInvoice,
  markPaid,
  removeCharge,
  voidInvoice,
} from "@/serverFunctions/billing";
import { Section } from "./Section";
import type { BookingData } from "./types";
import { z } from "zod";
import { t } from "@/lib/i18n";

type Invoice = BookingData["billing"]["invoices"][number];
const today = () => new Date().toISOString().slice(0, 10);
const in30 = () =>
  new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const STATUS: Record<
  string,
  { label: string; variant: "outline" | "success" | "destructive" | "soft" }
> = {
  issued: { label: "Issued", variant: "outline" },
  paid: { label: "Paid", variant: "success" },
  voided: { label: "Voided", variant: "destructive" },
};

export function BillingSection({ data }: { data: BookingData }) {
  const { billing, booking } = data;
  const [dialog, setDialog] = useState<"apply" | "charge" | "invoice" | null>(
    null,
  );
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const { run, pending } = useAction();
  const uninvoiced = billing.charges.filter((line) => !line.invoiceId);
  return (
    <Section
      title={t("Charges and invoices")}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog("apply")}
          >
            {t("Apply tariffs")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog("charge")}
          >
            <Plus data-icon="inline-start" />
            {t("Add charge")}
          </Button>
          <Button
            size="sm"
            disabled={uninvoiced.length === 0}
            onClick={() => setDialog("invoice")}
          >
            <Receipt data-icon="inline-start" />
            {t("Issue invoice")}
          </Button>
        </>
      }
    >
      <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("Invoiced")}</dt>
          <dd data-testid="invoiced-total" className="font-medium tabular-nums">
            {formatTotals(billing.invoiced)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Open balance")}</dt>
          <dd data-testid="open-balance" className="font-medium tabular-nums">
            {billing.open.length
              ? formatTotals(billing.open)
              : formatTotals(billing.invoiced.map((t) => ({ ...t, minor: 0 })))}
          </dd>
        </div>
      </dl>

      {billing.charges.length === 0 ? (
        <EmptyState title={t("No charges yet")} size="sm" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Charge")}</TableHead>
                <TableHead className="text-end">{t("Qty")}</TableHead>
                <TableHead className="text-end">{t("Unit price")}</TableHead>
                <TableHead className="text-end">{t("Amount")}</TableHead>
                <TableHead>{t("Invoice")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.charges.map((line) => (
                <TableRow key={line.id} data-testid="charge-row">
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {line.quantity}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMoney(line.unitMinor, line.currency)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMoney(line.quantity * line.unitMinor, line.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.invoiceNumber ?? ""}
                  </TableCell>
                  <TableCell className="text-end">
                    {line.invoiceId ? null : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${line.description}`}
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            removeCharge({
                              data: { bookingId: booking.id, id: line.id },
                            }),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {billing.invoices.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Number")}</TableHead>
                <TableHead>{t("Issued")}</TableHead>
                <TableHead>{t("Due")}</TableHead>
                <TableHead className="text-end">{t("Total")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.invoices.map((invoice) => (
                <TableRow key={invoice.id} data-testid="invoice-row">
                  <TableCell className="font-medium">
                    {invoice.number}
                    {invoice.credits ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("Credits")} {invoice.credits}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatTotals(invoice.totals)}
                  </TableCell>
                  <TableCell>
                    {invoice.kind === "credit_note" ? (
                      <Badge variant="soft">{t("Credit note")}</Badge>
                    ) : (
                      <Badge
                        variant={STATUS[invoice.status]?.variant ?? "outline"}
                      >
                        {t(STATUS[invoice.status]?.label ?? invoice.status)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/invoices/$id"
                        params={{ id: invoice.id }}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        {t("Open")}
                      </Link>
                      {invoice.kind === "invoice" &&
                      invoice.status === "issued" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              run(() => markPaid({ data: { id: invoice.id } }))
                            }
                          >
                            {t("Mark paid")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVoiding(invoice)}
                          >
                            {t("Void")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : null}

      {dialog === "apply" ? (
        <ApplyDialog bookingId={booking.id} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "charge" ? (
        <ChargeDialog bookingId={booking.id} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "invoice" ? (
        <InvoiceDialog bookingId={booking.id} onClose={() => setDialog(null)} />
      ) : null}
      {voiding ? (
        <ConfirmDialog
          title={`Void ${voiding.number}?`}
          confirmLabel={t("Void invoice")}
          destructive
          pending={pending}
          onClose={() => setVoiding(null)}
          onConfirm={async () => {
            await run(() => voidInvoice({ data: { id: voiding.id } }));
            setVoiding(null);
          }}
        >
          {t(
            "A credit note cancels it, and its charges can be invoiced again.",
          )}
        </ConfirmDialog>
      ) : null}
    </Section>
  );
}

function ApplyDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [days, setDays] = useState("");
  const [error, setError] = useState<string>();
  const { run, pending } = useAction();
  return (
    <FormDialog
      title={t("Apply tariffs")}
      submitLabel={t("Apply")}
      pending={pending}
      onClose={onClose}
      onSubmit={async () => {
        if (days && !/^\d{1,4}$/.test(days))
          return setError(t("Enter a whole number of days"));
        const result = await run(() =>
          applyTariffs({ data: { bookingId, days: Number(days || 0) } }),
        );
        if (result) onClose();
      }}
    >
      <Field label={t("Storage days")} error={error}>
        <Input
          value={days}
          onChange={(event) => setDays(event.target.value)}
          inputMode="numeric"
          placeholder={t("0")}
        />
      </Field>
    </FormDialog>
  );
}

const chargeForm = z.object({
  description: z.string().trim().min(1, "Enter a description"),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,5}$/, "Enter a whole number"),
  unitPrice: amountInput,
  currency: currencyInput,
});

function ChargeDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    description: "",
    quantity: "1",
    unitPrice: "",
    currency: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues({ ...values, [key]: event.target.value }),
  });
  return (
    <FormDialog
      title={t("Add charge")}
      submitLabel={t("Save charge")}
      pending={pending}
      onClose={onClose}
      onSubmit={async () => {
        const parsed = chargeForm.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        const done = await run(() =>
          addCharge({ data: { ...values, bookingId } }),
        );
        if (done) onClose();
      }}
    >
      <Field label={t("Description")} error={errors.description}>
        <Input {...bind("description")} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("Quantity")} error={errors.quantity}>
          <Input {...bind("quantity")} inputMode="numeric" />
        </Field>
        <CurrencyList />
        <Field label={t("Unit price")} error={errors.unitPrice}>
          <Input {...bind("unitPrice")} inputMode="decimal" />
        </Field>
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
    </FormDialog>
  );
}

function InvoiceDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    issueDate: today(),
    dueDate: in30(),
    taxPercent: "0",
    fee: "",
    feeCurrency: "USD",
    exchangeRate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  useEffect(() => {
    getCompany().then(({ company }) => {
      const pct = Number((company.defaultTaxBps / 100).toFixed(2));
      setValues((v) => ({ ...v, taxPercent: String(pct) }));
    });
  }, []);
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues({ ...values, [key]: event.target.value }),
  });
  return (
    <FormDialog
      title={t("Issue invoice")}
      submitLabel={t("Issue")}
      pending={pending}
      onClose={onClose}
      onSubmit={async () => {
        const next: Record<string, string> = {};
        if (parsePercent(values.taxPercent) === null)
          next.taxPercent = t("Enter a percentage from 0 to 100");
        if (
          values.fee.trim() !== "" &&
          (parseAmount(values.fee) === null || parseAmount(values.fee)! < 0)
        )
          next.fee = t("Enter an amount such as 25 or 12.50");
        if (
          values.fee.trim() !== "" &&
          !/^[A-Za-z]{3}$/.test(values.feeCurrency)
        )
          next.feeCurrency = t("Use a 3-letter code such as USD");
        if (parseRate(values.exchangeRate) === null)
          next.exchangeRate = t("Enter a rate such as 2600");
        setErrors(next);
        if (Object.keys(next).length) return;
        const done = await run(() =>
          issueInvoice({ data: { ...values, bookingId } }),
        );
        if (done) onClose();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t(
          "Every charge not yet invoiced goes on it. Issued invoices can't be edited.",
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Issue date")}>
          <Input type="date" {...bind("issueDate")} />
        </Field>
        <Field label={t("Due date")}>
          <Input type="date" {...bind("dueDate")} />
        </Field>
      </div>
      <Field label={t("Tax percent")} error={errors.taxPercent}>
        <Input {...bind("taxPercent")} inputMode="decimal" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Fee")} error={errors.fee}>
          <Input {...bind("fee")} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label={t("Fee currency")} error={errors.feeCurrency}>
          <Input
            {...bind("feeCurrency")}
            className="uppercase"
            maxLength={3}
            list="currency-codes"
          />
        </Field>
      </div>
      <Field
        label={t("Exchange rate (SDG for 1 USD, optional)")}
        error={errors.exchangeRate}
      >
        <Input
          {...bind("exchangeRate")}
          inputMode="decimal"
          placeholder="2600"
        />
      </Field>
    </FormDialog>
  );
}
