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
import { getBooking } from "@/serverFunctions/bookings";

export const Route = createFileRoute("/bookings/$id/bill-of-lading")({
  loader: ({ params }) => getBooking({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `Bill of lading ${loaderData?.booking.number ?? ""}` }],
  }),
  component: BillOfLading,
});

function BillOfLading() {
  const data = Route.useLoaderData();
  const { id } = Route.useParams();
  if (!data) {
    return (
      <AppShell>
        <PageHeader
          title="Bill of lading"
          backLink={<BackLink to="/">Bookings</BackLink>}
        />
        <EmptyState kind="error" title="Booking not found" />
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
        actions={<PrintButton />}
      />
      <div data-testid="bill-of-lading" className="space-y-6 text-sm">
        <dl className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <Item label="Shipper">
            {booking.customerName}
            {booking.customerEmail ? (
              <div className="text-muted-foreground">
                {booking.customerEmail}
              </div>
            ) : null}
          </Item>
          <Item label="Consignee">{booking.consignee || "—"}</Item>
          <Item label="Carrier">{booking.carrier || "—"}</Item>
          <Item label="Vessel / voyage">
            {[booking.vessel, booking.voyage].filter(Boolean).join(" ") || "—"}
          </Item>
          <Item label="Port of loading">{legs[0]?.fromPort ?? "—"}</Item>
          <Item label="Port of discharge">{legs.at(-1)?.toPort ?? "—"}</Item>
        </dl>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leg</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Vessel / voyage</TableHead>
              <TableHead>ETD</TableHead>
              <TableHead>ETA</TableHead>
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
              <TableHead>VIN</TableHead>
              <TableHead>Make / model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>L × W × H (cm)</TableHead>
              <TableHead className="text-right">Weight (kg)</TableHead>
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
                <TableCell className="text-right tabular-nums">
                  {v.weightKg?.toLocaleString("en-US") ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>
                {vehicles.length} {vehicles.length === 1 ? "unit" : "units"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {weight.toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {booking.cargoNotes ? (
          <Item label="Cargo notes">{booking.cargoNotes}</Item>
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
