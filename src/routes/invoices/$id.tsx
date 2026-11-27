import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { PrintButton } from "@/client/components/PrintButton";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/format";
import { equivalents, formatMoney, formatPercent } from "@/lib/shipping";
import { getCompany } from "@/serverFunctions/settings";
import { Letterhead } from "@/client/components/Letterhead";
import { PdfButton } from "@/client/components/PdfButton";
import { getInvoiceDocument } from "@/serverFunctions/billing";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/invoices/$id")({
  loader: async ({ params }) => ({
    doc: await getInvoiceDocument({ data: { id: params.id } }),
    company: (await getCompany()).company,
  }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.doc?.invoice.number ?? "Invoice" }],
  }),
  component: InvoicePage,
});

function InvoicePage() {
  const { doc, company } = Route.useLoaderData();
  if (!doc) {
    return (
      <AppShell>
        <PageHeader
          title={t("Invoice")}
          backLink={<BackLink to="/">{t("Bookings")}</BackLink>}
        />
        <EmptyState kind="error" title={t("Invoice not found")} />
      </AppShell>
    );
  }
  const { invoice, booking, lines, totals, breakdown } = doc;
  const hasExtras = invoice.taxBps !== 0 || breakdown.some((r) => r.fee !== 0);
  const both = equivalents(totals, invoice.exchangeRate);
  const credit = invoice.kind === "credit_note";
  return (
    <AppShell>
      <PageHeader
        title={`${credit ? "Credit note" : "Invoice"} ${invoice.number}`}
        backLink={
          <span className="print:hidden">
            <BackLink to="/bookings/$id" params={{ id: booking.id }}>
              {booking.number}
            </BackLink>
          </span>
        }
        description={
          invoice.status === "voided" ? (
            <Badge variant="destructive">{t("Voided")}</Badge>
          ) : invoice.status === "paid" ? (
            <Badge variant="success">{t("Paid")}</Badge>
          ) : null
        }
        actions={
          <div className="flex gap-2">
            <PdfButton targetId="document" fileName={invoice.number} />
            <PrintButton />
          </div>
        }
      />
      <div id="document" className="space-y-6 bg-background">
        <Letterhead company={company} />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("Bill to")}</dt>
            <dd className="font-medium">{booking.customerName}</dd>
            {booking.customerEmail ? <dd>{booking.customerEmail}</dd> : null}
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Booking")}</dt>
            <dd className="font-medium">{booking.number}</dd>
            <dd>
              {[booking.origin, booking.destination]
                .filter(Boolean)
                .join(" → ")}
            </dd>
            <dd>
              {[booking.vessel, booking.voyage].filter(Boolean).join(" ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Issued")}</dt>
            <dd>{formatDate(invoice.issueDate)}</dd>
          </div>
          {invoice.dueDate ? (
            <div>
              <dt className="text-muted-foreground">{t("Due")}</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
            </div>
          ) : null}
          {invoice.credits ? (
            <div>
              <dt className="text-muted-foreground">{t("Credits")}</dt>
              <dd>{invoice.credits}</dd>
            </div>
          ) : null}
        </dl>
        <Table data-testid="document-lines">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Description")}</TableHead>
              <TableHead className="text-end">{t("Qty")}</TableHead>
              <TableHead className="text-end">{t("Unit price")}</TableHead>
              <TableHead className="text-end">{t("Amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
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
              </TableRow>
            ))}
          </TableBody>
          <TableFooter data-testid="document-total">
            {breakdown.flatMap((r) => [
              ...(hasExtras
                ? [
                    <TableRow key={`${r.currency}-sub`}>
                      <TableCell colSpan={3}>
                        {t("Subtotal")} {r.currency}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoney(r.subtotal, r.currency)}
                      </TableCell>
                    </TableRow>,
                  ]
                : []),
              ...(invoice.taxBps !== 0
                ? [
                    <TableRow key={`${r.currency}-tax`}>
                      <TableCell colSpan={3}>
                        {t("Tax")} {formatPercent(invoice.taxBps)} {r.currency}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoney(r.tax, r.currency)}
                      </TableCell>
                    </TableRow>,
                  ]
                : []),
              ...(r.fee !== 0
                ? [
                    <TableRow key={`${r.currency}-fee`}>
                      <TableCell colSpan={3}>
                        {t("Fee")} {r.currency}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoney(r.fee, r.currency)}
                      </TableCell>
                    </TableRow>,
                  ]
                : []),
              <TableRow key={`${r.currency}-total`}>
                <TableCell colSpan={3}>
                  {t("Total")} {r.currency}
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {formatMoney(r.total, r.currency)}
                </TableCell>
              </TableRow>,
            ])}
          </TableFooter>
        </Table>
        {both ? (
          <div
            data-testid="document-rate"
            className="rounded-lg border border-border p-3 text-sm"
          >
            <p className="text-muted-foreground">
              {t("Exchange rate")}: 1 USD = {invoice.exchangeRate} SDG
            </p>
            <p className="font-medium tabular-nums">
              {t("Total")}: {formatMoney(both.usd, "USD")} ·{" "}
              {formatMoney(both.sdg, "SDG")}
            </p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
