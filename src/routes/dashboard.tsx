import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { formatTotals, STATUSES, statusLabel } from "@/lib/shipping";
import { getDashboard } from "@/serverFunctions/reports";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboard(),
  head: () => ({ meta: [{ title: "Dashboard · Vehicle Shipments" }] }),
  component: Dashboard,
});

function Card({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: string;
  testId?: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        data-testid={testId}
        className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}
      >
        <bdi dir="ltr">{value}</bdi>
      </div>
    </div>
  );
}

function Dashboard() {
  const d = Route.useLoaderData();
  const max = Math.max(1, ...STATUSES.map((s) => d.byStatus[s] ?? 0));
  return (
    <AppShell>
      <PageHeader
        title={t("Dashboard")}
        description={t("Where your shipments and money stand today.")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          label={t("Active bookings")}
          value={String(d.activeBookings)}
          testId="dash-active"
        />
        <Card
          label={t("Vehicles in transit")}
          value={String(d.vehiclesInTransit)}
          testId="dash-vehicles"
        />
        <Card
          label={t("Open balance")}
          value={formatTotals(d.openBalance)}
          testId="dash-open"
        />
        <Card
          label={`${t("Overdue")} (${d.overdueCount})`}
          value={formatTotals(d.overdueBalance)}
          testId="dash-overdue"
          tone={d.overdueCount ? "warn" : undefined}
        />
        <Card
          label={t("Paid")}
          value={formatTotals(d.paidTotal)}
          testId="dash-paid"
        />
        <Card label={t("All bookings")} value={String(d.totalBookings)} />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("Bookings by status")}</h2>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0">{statusLabel(s)}</span>
              <div className="h-3 flex-1 rounded bg-muted">
                <div
                  className="h-3 rounded bg-primary"
                  style={{ width: `${((d.byStatus[s] ?? 0) / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-end tabular-nums">
                {d.byStatus[s] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("Active shipments")}</h2>
        {d.active.length === 0 ? (
          <EmptyState title={t("No active shipments")} size="sm" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {d.active.map((b) => (
              <li key={b.id}>
                <Link
                  to="/bookings/$id"
                  params={{ id: b.id }}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <span>
                    <span className="font-medium">{b.number}</span> ·{" "}
                    {b.customerName}
                    <span className="block text-muted-foreground">
                      {b.route} · {b.units} {t("vehicles")}
                    </span>
                  </span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
