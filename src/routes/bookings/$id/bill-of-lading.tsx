import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { PrintButton } from "@/client/components/PrintButton";
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
import { getCompany } from "@/serverFunctions/settings";
import { Letterhead } from "@/client/components/Letterhead";
import { PdfButton } from "@/client/components/PdfButton";
import { getBooking } from "@/serverFunctions/bookings";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/bookings/$id/bill-of-lading")({
  loader: async ({ params }) => ({
    data: await getBooking({ data: { id: params.id } }),
    company: (await getCompany()).company,
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Bill of lading ${loaderData?.data?.booking.number ?? ""}` },
    ],
  }),
  component: BillOfLading,
});

function BillOfLading() {
  const { data, company } = Route.useLoaderData();
  const { id } = Route.useParams();
  if (!data) {
    return (
      <AppShell>
        <PageHeader
          title={t("Bill of lading")}
          backLink={<BackLink to="/">{t("Bookings")}</BackLink>}
        />
        <EmptyState kind="error" title={t("Booking not found")} />
      </AppShell>
    );
  }
  const { booking, legs, vehicles } = data;
  const weight = vehicles.reduce((sum, v) => sum + (v.weightKg ?? 0), 0);
  return (
    <AppShell wide>
      <PageHeader
        title={`Bill of lading ${booking.number}`}
        backLink={
          <span className="print:hidden">
            <BackLink to="/bookings/$id" params={{ id }}>
              {booking.number}
            </BackLink>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <PdfButton
              targetId="bill-of-lading"
              fileName={`BL-${booking.number}`}
            />
            <PrintButton />
          </div>
        }
      />
      <div
        id="bill-of-lading"
        data-testid="bill-of-lading"
        className="space-y-6 bg-background text-sm"
      >
        <Letterhead company={company} />
        <dl className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <Item label={t("Shipper")}>
            {booking.customerName}
            {booking.customerEmail ? (
              <div className="text-muted-foreground">
                {booking.customerEmail}
              </div>
            ) : null}
          </Item>
          <Item label={t("Consignee")}>{booking.consignee || "—"}</Item>
          <Item label={t("Carrier")}>{booking.carrier || "—"}</Item>
          <Item label={t("Vessel / voyage")}>
            {[booking.vessel, booking.voyage].filter(Boolean).join(" ") || "—"}
          </Item>
          <Item label={t("Port of loading")}>{legs[0]?.fromPort ?? "—"}</Item>
          <Item label={t("Port of discharge")}>
            {legs.at(-1)?.toPort ?? "—"}
          </Item>
        </dl>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Leg")}</TableHead>
              <TableHead>{t("From")}</TableHead>
              <TableHead>{t("To")}</TableHead>
              <TableHead>{t("Vessel / voyage")}</TableHead>
              <TableHead>{t("ETD")}</TableHead>
              <TableHead>{t("ETA")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legs.map((leg, index) => (
              <TableRow key={leg.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{leg.fromPort}</TableCell>
                <TableCell>{leg.toPort}</TableCell>
                <TableCell>{leg.vesselVoyage}</TableCell>
                <TableCell>{formatDate(leg.etd)}</TableCell>
                <TableCell>{formatDate(leg.eta)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("VIN")}</TableHead>
              <TableHead>{t("Make / model")}</TableHead>
              <TableHead>{t("Year")}</TableHead>
              <TableHead>{t("L × W × H (cm)")}</TableHead>
              <TableHead className="text-end">{t("Weight (kg)")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.vin}</TableCell>
                <TableCell>
                  {[v.make, v.model].filter(Boolean).join(" ")}
                </TableCell>
                <TableCell>{v.year ?? ""}</TableCell>
                <TableCell className="tabular-nums">{`${v.lengthCm ?? "?"} × ${v.widthCm ?? "?"} × ${v.heightCm ?? "?"}`}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {v.weightKg?.toLocaleString("en-US") ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>
                {vehicles.length} {t(vehicles.length === 1 ? "unit" : "units")}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {weight.toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {booking.cargoNotes ? (
          <Item label={t("Cargo notes")}>{booking.cargoNotes}</Item>
        ) : null}
      </div>
    </AppShell>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
