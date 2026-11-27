import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
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
import { formatDate, formatDateTime } from "@/client/lib/format";
import { getPublicTracking } from "@/serverFunctions/tracking";
import { t } from "@/lib/i18n";
import { LanguageSwitch } from "@/client/components/LanguageSwitch";

// Public (everyapp.config.ts): anyone with the token sees this page.
export const Route = createFileRoute("/t/$token")({
  loader: async ({ params }) => {
    const tracking = await getPublicTracking({ data: { token: params.token } });
    if (!tracking) throw notFound();
    return tracking;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Shipment ${loaderData.booking.number}`
          : "Shipment",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <Frame>
      <EmptyState
        kind="error"
        title={t("Tracking link not found")}
        description={t("Ask the sender for a current link.")}
      />
    </Frame>
  ),
  component: TrackingPage,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto">
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pt-8 pb-24 md:px-10 md:pt-10">
        <div className="flex justify-end">
          <div className="rounded-lg bg-sidebar p-0.5 text-sidebar-foreground">
            <LanguageSwitch />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function TrackingPage() {
  const { booking, legs, events, vehicles } = Route.useLoaderData();
  const [vin, setVin] = useState("");
  const query = vin.trim().toUpperCase();
  const shown = query
    ? vehicles.filter((v) => v.vin.includes(query))
    : vehicles;
  return (
    <Frame>
      <PageHeader
        title={booking.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span data-testid="tracking-status">
              <StatusBadge status={booking.status} />
            </span>
            {[booking.carrier, booking.vessel, booking.voyage]
              .filter(Boolean)
              .join(" · ")}
          </span>
        }
      />
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("Route")}</h2>
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("From")}</TableHead>
                <TableHead>{t("To")}</TableHead>
                <TableHead>{t("Vessel / voyage")}</TableHead>
                <TableHead>{t("ETD")}</TableHead>
                <TableHead>{t("ETA")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legs.map((leg, index) => (
                <TableRow key={index} data-testid="tracking-leg">
                  <TableCell>{leg.fromPort}</TableCell>
                  <TableCell>{leg.toPort}</TableCell>
                  <TableCell>{leg.vesselVoyage}</TableCell>
                  <TableCell>{formatDate(leg.etd)}</TableCell>
                  <TableCell>{formatDate(leg.eta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("Milestones")}</h2>
        <ol className="space-y-2 border-s border-border ps-4">
          {events.map((event, index) => (
            <li
              key={index}
              data-testid="tracking-event"
              className="flex flex-wrap items-center gap-2"
            >
              <StatusBadge status={event.status} />
              <span className="text-sm text-muted-foreground">
                {formatDateTime(event.occurredAt)}
                {event.location ? ` · ${event.location}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("Vehicles")}</h2>
        <Field label={t("Find a VIN")} className="max-w-xs">
          <Input
            value={vin}
            onChange={(event) => setVin(event.target.value)}
            className="font-mono uppercase"
          />
        </Field>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("No vehicle on this shipment matches.")}
          </p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("VIN")}</TableHead>
                  <TableHead>{t("Vehicle")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((v) => (
                  <TableRow key={v.vin} data-testid="tracking-vehicle">
                    <TableCell className="font-mono text-xs">{v.vin}</TableCell>
                    <TableCell>
                      {[v.make, v.model, v.year].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </section>
    </Frame>
  );
}
