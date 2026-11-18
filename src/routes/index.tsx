import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/client/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/format";
import { STATUSES, STATUS_LABELS } from "@/lib/shipping";
import { searchBookings } from "@/serverFunctions/bookings";

const SORTS = [
  "number",
  "customer",
  "status",
  "departs",
  "units",
  "created",
] as const;
type Sort = (typeof SORTS)[number];

const search = z.object({
  q: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  carrier: z.string().optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});
type Search = z.infer<typeof search>;

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchBookings({ data: deps }),
  head: () => ({ meta: [{ title: "Bookings · Vehicle Shipments" }] }),
  component: Bookings,
});

function Bookings() {
  const result = Route.useLoaderData();
  const current = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [form, setForm] = useState({
    q: current.q ?? "",
    status: current.status ?? "",
    carrier: current.carrier ?? "",
    from: current.from ?? "",
    to: current.to ?? "",
  });
  const filtered = Boolean(
    current.q ||
      current.status ||
      current.carrier ||
      current.from ||
      current.to,
  );
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function submit(event: FormEvent) {
    event.preventDefault();
    void navigate({
      search: (prev: Search) => ({
        sort: prev.sort,
        dir: prev.dir,
        q: form.q.trim() || undefined,
        status: (form.status || undefined) as Search["status"],
        carrier: form.carrier || undefined,
        from: form.from || undefined,
        to: form.to || undefined,
      }),
    });
  }

  function sortBy(column: Sort) {
    const dir =
      current.sort === column && current.dir === "asc" ? "desc" : "asc";
    void navigate({
      search: (prev: Search) => ({
        ...prev,
        sort: column,
        dir,
        page: undefined,
      }),
    });
  }

  const header = (column: Sort, label: string, align?: "right") => {
    const active = current.sort === column;
    return (
      <TableHead
        className={align === "right" ? "text-right" : undefined}
        aria-sort={
          active ? (current.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          onClick={() => sortBy(column)}
          aria-label={`Sort by ${label}`}
          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
        >
          {label}
          {active ? (
            current.dir === "asc" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : null}
        </button>
      </TableHead>
    );
  };

  return (
    <AppShell wide>
      <PageHeader
        title="Bookings"
        actions={
          <Link to="/bookings/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            New booking
          </Link>
        }
      />

      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      >
        <Field label="Search" className="sm:col-span-2">
          <Input
            type="search"
            value={form.q}
            onChange={(event) => setForm({ ...form, q: event.target.value })}
            placeholder="Booking, VIN, customer, vessel or port"
          />
        </Field>
        <Field label="Status">
          <NativeSelect
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value })
            }
          >
            <NativeSelectOption value="">Any</NativeSelectOption>
            {STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Carrier">
          <NativeSelect
            value={form.carrier}
            onChange={(event) =>
              setForm({ ...form, carrier: event.target.value })
            }
          >
            <NativeSelectOption value="">Any</NativeSelectOption>
            {result.carriers.map((carrier) => (
              <NativeSelectOption key={carrier} value={carrier}>
                {carrier}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Departs from">
          <Input
            type="date"
            value={form.from}
            onChange={(event) => setForm({ ...form, from: event.target.value })}
          />
        </Field>
        <Field label="Departs by">
          <Input
            type="date"
            value={form.to}
            onChange={(event) => setForm({ ...form, to: event.target.value })}
          />
        </Field>
        <div className="flex gap-2 lg:col-span-6">
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm({ q: "", status: "", carrier: "", from: "", to: "" });
                void navigate({ search: {} });
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {result.total === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No bookings match" />
        ) : (
          <EmptyState
            title="No bookings yet"
            description="Create one to start adding vehicles and route legs."
            action={
              <Link
                to="/bookings/new"
                className={buttonVariants({ variant: "outline" })}
              >
                New booking
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  {header("number", "Booking")}
                  {header("customer", "Customer")}
                  <TableHead>Route</TableHead>
                  <TableHead>Vessel</TableHead>
                  {header("departs", "Departs")}
                  {header("units", "Units", "right")}
                  {header("status", "Status")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id} data-testid="booking-row">
                    <TableCell className="font-medium">
                      <Link
                        to="/bookings/$id"
                        params={{ id: row.id }}
                        className="text-primary hover:underline"
                      >
                        {row.number}
                      </Link>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>
                      {row.origin ? `${row.origin} → ${row.destination}` : ""}
                    </TableCell>
                    <TableCell>
                      {[row.vessel, row.voyage].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>{formatDate(row.departs)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.units}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span data-testid="result-count">
              {result.total} {result.total === 1 ? "booking" : "bookings"}
            </span>
            {pages > 1 ? (
              <div className="flex items-center gap-2">
                <span>
                  Page {result.page} of {pages}
                </span>
                <PageLink
                  page={result.page - 1}
                  disabled={result.page <= 1}
                  label="Previous page"
                >
                  <ChevronLeft />
                </PageLink>
                <PageLink
                  page={result.page + 1}
                  disabled={result.page >= pages}
                  label="Next page"
                >
                  <ChevronRight />
                </PageLink>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PageLink({
  page,
  disabled,
  label,
  children,
}: {
  page: number;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" aria-label={label} disabled>
        {children}
      </Button>
    );
  }
  return (
    <Link
      to="/"
      search={(prev: Search) => ({ ...prev, page })}
      aria-label={label}
      className={buttonVariants({ variant: "outline", size: "icon" })}
    >
      {children}
    </Link>
  );
}
