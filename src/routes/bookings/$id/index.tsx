import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { BillingSection } from "@/client/features/BillingSection";
import { DetailsSection } from "@/client/features/DetailsSection";
import { DocumentsSection } from "@/client/features/DocumentsSection";
import { LegsSection } from "@/client/features/LegsSection";
import { StatusSection } from "@/client/features/StatusSection";
import { TrackingSection } from "@/client/features/TrackingSection";
import { VehiclesSection } from "@/client/features/VehiclesSection";
import { useAction } from "@/client/hooks/useAction";
import {
  deleteBooking,
  getBooking,
  reopenBooking,
} from "@/serverFunctions/bookings";
import { NotificationsSection } from "@/client/features/NotificationsSection";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/bookings/$id/")({
  loader: ({ params }) => getBooking({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.booking.number ?? "Booking"} · Vehicle Shipments`,
      },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useAction();
  const back = <BackLink to="/">{t("Bookings")}</BackLink>;

  if (!data) {
    return (
      <AppShell>
        <PageHeader title={t("Booking")} backLink={back} />
        <EmptyState
          kind="error"
          title={t("Booking not found")}
          description={t("It was deleted, or it isn't one of yours.")}
        />
      </AppShell>
    );
  }

  const { booking, legs } = data;
  const route = legs.length
    ? [legs[0]!.fromPort, ...legs.map((leg) => leg.toPort)].join(" → ")
    : "";
  return (
    <AppShell wide>
      <PageHeader
        title={booking.number}
        backLink={back}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} testId="booking-status" />
            <span>{booking.customerName}</span>
            {route ? <span>· {route}</span> : null}
          </span>
        }
        actions={
          <Button variant="outline" onClick={() => setConfirmDelete(true)}>
            <Trash2 data-icon="inline-start" />
            {t("Delete booking")}
          </Button>
        }
      />
      <VehiclesSection
        data={data}
        onReopen={() =>
          void run(() => reopenBooking({ data: { id: booking.id } }))
        }
      />
      <LegsSection data={data} />
      <StatusSection data={data} />
      <DetailsSection data={data} />
      <BillingSection data={data} />
      <DocumentsSection data={data} />
      <TrackingSection data={data} />
      <NotificationsSection data={data} />
      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${booking.number}?`}
          confirmLabel={t("Delete booking")}
          destructive
          pending={pending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const done = await run(() =>
              deleteBooking({ data: { id: booking.id } }),
            );
            if (done) await navigate({ to: "/" });
          }}
        >
          {t("Its vehicles, history, invoices and files are deleted too.")}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
