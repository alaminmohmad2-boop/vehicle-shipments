import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { buttonVariants } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatTotals } from "@/lib/shipping";
import { getCustomerReport } from "@/serverFunctions/reports";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/reports")({
  loader: () => getCustomerReport(),
  head: () => ({ meta: [{ title: "Reports · Vehicle Shipments" }] }),
  component: Reports,
});

const EXPORTS = [
  ["bookings", "Bookings (Excel/CSV)"],
  ["vehicles", "Vehicles (Excel/CSV)"],
  ["invoices", "Invoices (Excel/CSV)"],
  ["customers", "Customer report (Excel/CSV)"],
] as const;

function Reports() {
  const rows = Route.useLoaderData();
  return (
    <AppShell wide>
      <PageHeader
        title={t("Reports")}
        description={t(
          "Export your data to Excel (CSV files) and see what each customer owes.",
        )}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {EXPORTS.map(([kind, label]) => (
              <a
                key={kind}
                href={`/api/export/${kind}`}
                download
                data-testid={`export-${kind}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download data-icon="inline-start" />
                {t(label)}
              </a>
            ))}
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={t("No customers yet")} />
      ) : (
        <TableCard>
          <Table data-testid="customer-report">
            <TableHeader>
              <TableRow>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead className="text-end">{t("Bookings")}</TableHead>
                <TableHead className="text-end">{t("Vehicles")}</TableHead>
                <TableHead className="text-end">{t("Invoiced")}</TableHead>
                <TableHead className="text-end">{t("Paid")}</TableHead>
                <TableHead className="text-end">{t("Owed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.customer}>
                  <TableCell className="font-medium">{r.customer}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {r.bookings}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {r.vehicles}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <bdi dir="ltr">{formatTotals(r.invoiced)}</bdi>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <bdi dir="ltr">{formatTotals(r.paid)}</bdi>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <bdi dir="ltr">{formatTotals(r.owed)}</bdi>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AppShell>
  );
}
