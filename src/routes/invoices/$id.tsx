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
import { formatMoney } from "@/lib/shipping";
import { getInvoiceDocument } from "@/serverFunctions/billing";

export const Route = createFileRoute("/invoices/$id")({
  loader: ({ params }) => getInvoiceDocument({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.invoice.number ?? "Invoice" }],
  }),
  component: InvoicePage,
});

function InvoicePage() {
  const doc = Route.useLoaderData();
  if (!doc) {
    return (
      <AppShell>
        <PageHeader
          title="Invoice"
          backLink={<BackLink to="/">Bookings</BackLink>}
        />
        <EmptyState kind="error" title="Invoice not found" />
      </AppShell>
    );
  }
  const { invoice, booking, lines, totals } = doc;
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
            <Badge variant="destructive">Voided</Badge>
          ) : invoice.status === "paid" ? (
            <Badge variant="success">Paid</Badge>
          ) : null
        }
        actions={<PrintButton />}
      />
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Bill to</dt>
          <dd className="font-medium">{booking.customerName}</dd>
          {booking.customerEmail ? <dd>{booking.customerEmail}</dd> : null}
        </div>
        <div>
          <dt className="text-muted-foreground">Booking</dt>
          <dd className="font-medium">{booking.number}</dd>
          <dd>
            {[booking.origin, booking.destination].filter(Boolean).join(" → ")}
          </dd>
          <dd>{[booking.vessel, booking.voyage].filter(Boolean).join(" ")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Issued</dt>
          <dd>{formatDate(invoice.issueDate)}</dd>
        </div>
        {invoice.dueDate ? (
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </div>
        ) : null}
        {invoice.credits ? (
          <div>
            <dt className="text-muted-foreground">Credits</dt>
            <dd>{invoice.credits}</dd>
          </div>
        ) : null}
      </dl>
      <Table data-testid="document-lines">
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>{line.description}</TableCell>
              <TableCell className="text-right tabular-nums">
                {line.quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(line.unitMinor, line.currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(line.quantity * line.unitMinor, line.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter data-testid="document-total">
          {totals.map((total) => (
            <TableRow key={total.currency}>
              <TableCell colSpan={3}>Total {total.currency}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(total.minor, total.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableFooter>
      </Table>
    </AppShell>
  );
}
