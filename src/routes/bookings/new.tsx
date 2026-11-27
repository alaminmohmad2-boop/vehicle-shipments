import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/client/components/AppShell";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  BookingFieldset,
  emptyBooking,
  emptyLeg,
  LegFieldset,
  type LegValues,
} from "@/client/features/BookingFields";
import { errorMessage } from "@/client/lib/format";
import { createBookingInput, fieldErrors } from "@/lib/shipping";
import { createBooking } from "@/serverFunctions/bookings";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/bookings/new")({
  head: () => ({ meta: [{ title: "New booking · Vehicle Shipments" }] }),
  component: NewBooking,
});

function NewBooking() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(emptyBooking);
  const [legs, setLegs] = useState<LegValues[]>([emptyLeg]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const parsed = createBookingInput.safeParse({ ...booking, legs });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { id } = await createBooking({ data: { ...booking, legs } });
      await navigate({ to: "/bookings/$id", params: { id } });
    } catch (error) {
      setFailure(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={t("New booking")}
        backLink={<BackLink to="/">{t("Bookings")}</BackLink>}
      />
      <form onSubmit={submit} noValidate className="space-y-8">
        <BookingFieldset
          values={booking}
          errors={errors}
          onChange={setBooking}
        />
        <section className="space-y-4">
          <h2 className="text-base font-semibold">{t("Route")}</h2>
          {legs.map((leg, index) => (
            <div
              key={index}
              data-testid="leg-fields"
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {t("Leg")} {index + 1}
                </h3>
                {legs.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove leg ${index + 1}`}
                    onClick={() => setLegs(legs.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              <LegFieldset
                values={leg}
                errors={errors}
                prefix={`legs.${index}.`}
                onChange={(next) =>
                  setLegs(legs.map((old, i) => (i === index ? next : old)))
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const last = legs.at(-1);
              setLegs([
                ...legs,
                {
                  ...emptyLeg,
                  fromPort: last?.toPort ?? "",
                  vesselVoyage: last?.vesselVoyage ?? "",
                },
              ]);
            }}
          >
            <Plus data-icon="inline-start" />
            {t("Add leg")}
          </Button>
        </section>
        {failure ? (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" pending={pending}>
          {t("Create booking")}
        </Button>
      </form>
    </AppShell>
  );
}
