import { createFileRoute } from "@tanstack/react-router";
import { LogIn, LogOut, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
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
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/hooks/useAction";
import { formatDateTime } from "@/client/lib/format";
import { t } from "@/lib/i18n";
import {
  addInspection,
  deleteYard,
  getYardOverview,
  logYardEvent,
  requestRelease,
  reviewRelease,
  saveYard,
} from "@/serverFunctions/yard";

export const Route = createFileRoute("/yard")({
  loader: () => getYardOverview(),
  head: () => ({ meta: [{ title: "Yard · Vehicle Shipments" }] }),
  component: YardPage,
});

type Overview = Awaited<ReturnType<typeof getYardOverview>>;
type YardRow = Overview["yards"][number];

const TABS = [
  "Yards",
  "In yard",
  "Gate log",
  "Inspections",
  "Releases",
] as const;
type Tab = (typeof TABS)[number];

const EVENT_LABEL: Record<string, string> = {
  entry: "Entry",
  exit: "Exit",
  move: "Move",
};
const STAGE_LABEL: Record<string, string> = {
  gate_in: "Gate in",
  storage: "In storage",
  gate_out: "Gate out",
};
const CONDITION_LABEL: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
};
const RELEASE_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released",
};
const TONE: Record<string, string> = {
  good: "bg-success/15 text-success",
  fair: "bg-warning/25 text-warning-foreground",
  damaged: "bg-destructive/15 text-destructive",
  pending: "bg-warning/25 text-warning-foreground",
  approved: "bg-info/15 text-info",
  rejected: "bg-destructive/15 text-destructive",
  released: "bg-success/15 text-success",
};

function Pill({ value, label }: { value: string; label: string }) {
  return (
    <Badge variant="outline" className={`border-0 ${TONE[value] ?? ""}`}>
      {t(label)}
    </Badge>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.06)]">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        <bdi dir="ltr">{value}</bdi>
      </div>
    </div>
  );
}

const vinCell = (vin: string) => (
  <bdi dir="ltr" className="font-mono text-xs">
    {vin}
  </bdi>
);

type Dialog =
  | { type: "yard"; yard: YardRow | null }
  | {
      type: "event";
      kind: "entry" | "exit" | "move";
      vin?: string;
      yardId?: string;
    }
  | { type: "inspection"; vin?: string }
  | { type: "release"; vin?: string }
  | { type: "review"; id: string; status: "approved" | "rejected" | "released" }
  | { type: "delete"; yard: YardRow }
  | null;

function YardPage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("Yards");
  const [dialog, setDialog] = useState<Dialog>(null);
  const yardName = (id: string | null) =>
    data.yards.find((y) => y.id === id)?.name ?? "-";
  const capacity = data.yards.reduce((n, y) => n + y.capacity, 0);
  const onClose = () => setDialog(null);
  return (
    <AppShell wide>
      <PageHeader
        title={t("Yard")}
        description={t("Storage yards, gate log, inspections and releases.")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setDialog({ type: "event", kind: "exit" })}
            >
              <LogOut data-icon="inline-start" />
              {t("Gate exit")}
            </Button>
            <Button onClick={() => setDialog({ type: "event", kind: "entry" })}>
              <LogIn data-icon="inline-start" />
              {t("Gate entry")}
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("Yards")} value={String(data.yards.length)} />
        <Stat
          label={t("Vehicles in yard")}
          value={String(data.present.length)}
        />
        <Stat label={t("Capacity")} value={String(capacity)} />
        <Stat
          label={t("Open release requests")}
          value={String(
            data.requests.filter(
              (r) => r.status === "pending" || r.status === "approved",
            ).length,
          )}
        />
      </div>
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
      >
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === name
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(name)}
          </button>
        ))}
      </div>

      {tab === "Yards" ? (
        <Section
          action={
            data.canAdmin ? (
              <Button onClick={() => setDialog({ type: "yard", yard: null })}>
                <Plus data-icon="inline-start" />
                {t("New yard")}
              </Button>
            ) : null
          }
          empty={data.yards.length === 0 ? t("No yards yet") : null}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Code")}</TableHead>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("City")}</TableHead>
                <TableHead className="w-56">{t("Occupancy")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.yards.map((y) => {
                const pct = Math.min(
                  100,
                  Math.round((y.occupied / y.capacity) * 100),
                );
                return (
                  <TableRow key={y.id}>
                    <TableCell className="font-mono text-xs">
                      {y.code}
                    </TableCell>
                    <TableCell className="font-medium">{y.name}</TableCell>
                    <TableCell>{y.city || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-muted">
                          <div
                            className={`h-2 rounded ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">
                          <bdi dir="ltr">
                            {y.occupied}/{y.capacity}
                          </bdi>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(y.status === "active" ? "Active" : "Closed")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {data.canAdmin ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ type: "yard", yard: y })}
                          >
                            {t("Edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDialog({ type: "delete", yard: y })
                            }
                          >
                            {t("Delete")}
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {tab === "In yard" ? (
        <Section
          empty={data.present.length === 0 ? t("No vehicles in a yard") : null}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VIN</TableHead>
                <TableHead>{t("Yard")}</TableHead>
                <TableHead>{t("Zone / slot")}</TableHead>
                <TableHead>{t("Since")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.present.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{vinCell(p.vin)}</TableCell>
                  <TableCell>{yardName(p.yardId)}</TableCell>
                  <TableCell>
                    {[p.zone, p.slot].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDialog({
                            type: "event",
                            kind: "move",
                            vin: p.vin,
                            yardId: p.yardId,
                          })
                        }
                      >
                        {t("Move")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDialog({ type: "inspection", vin: p.vin })
                        }
                      >
                        {t("Inspect")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDialog({ type: "release", vin: p.vin })
                        }
                      >
                        {t("Request release")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {tab === "Gate log" ? (
        <Section
          empty={data.events.length === 0 ? t("No gate activity yet") : null}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("When")}</TableHead>
                <TableHead>{t("Event")}</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>{t("Yard")}</TableHead>
                <TableHead>{t("Zone / slot")}</TableHead>
                <TableHead>{t("Driver")}</TableHead>
                <TableHead>{t("Truck plate")}</TableHead>
                <TableHead>{t("Seal")}</TableHead>
                <TableHead>{t("By")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell>{t(EVENT_LABEL[e.kind] ?? e.kind)}</TableCell>
                  <TableCell>{vinCell(e.vin)}</TableCell>
                  <TableCell>{yardName(e.yardId)}</TableCell>
                  <TableCell>
                    {[e.zone, e.slot].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell>
                    {[e.driverName, e.carrier].filter(Boolean).join(" · ") ||
                      "-"}
                  </TableCell>
                  <TableCell>{e.truckPlate || "-"}</TableCell>
                  <TableCell>{e.sealNumber || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.actorEmail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {tab === "Inspections" ? (
        <Section
          action={
            <Button onClick={() => setDialog({ type: "inspection" })}>
              <Plus data-icon="inline-start" />
              {t("New inspection")}
            </Button>
          }
          empty={data.inspections.length === 0 ? t("No inspections yet") : null}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("When")}</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>{t("Stage")}</TableHead>
                <TableHead>{t("Condition")}</TableHead>
                <TableHead>{t("Odometer (km)")}</TableHead>
                <TableHead>{t("Fuel %")}</TableHead>
                <TableHead>{t("Damage notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.inspections.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{formatDateTime(i.createdAt)}</TableCell>
                  <TableCell>{vinCell(i.vin)}</TableCell>
                  <TableCell>{t(STAGE_LABEL[i.stage] ?? i.stage)}</TableCell>
                  <TableCell>
                    <Pill
                      value={i.condition}
                      label={CONDITION_LABEL[i.condition] ?? i.condition}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {i.odometerKm ?? "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {i.fuelPercent ?? "-"}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal">
                    {i.damageNotes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {tab === "Releases" ? (
        <Section
          action={
            <Button onClick={() => setDialog({ type: "release" })}>
              <Plus data-icon="inline-start" />
              {t("Request release")}
            </Button>
          }
          empty={
            data.requests.length === 0 ? t("No release requests yet") : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("When")}</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead>{t("Recipient")}</TableHead>
                <TableHead>{t("Pickup date")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>{vinCell(r.vin)}</TableCell>
                  <TableCell>{r.customerName || "-"}</TableCell>
                  <TableCell>
                    {r.recipientName}
                    <span className="block text-xs text-muted-foreground">
                      {[r.recipientId, r.recipientPhone]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell>{r.pickupDate || "-"}</TableCell>
                  <TableCell>
                    <Pill
                      value={r.status}
                      label={RELEASE_LABEL[r.status] ?? r.status}
                    />
                  </TableCell>
                  <TableCell>
                    {data.canAdmin && r.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDialog({
                              type: "review",
                              id: r.id,
                              status: "approved",
                            })
                          }
                        >
                          {t("Approve")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDialog({
                              type: "review",
                              id: r.id,
                              status: "rejected",
                            })
                          }
                        >
                          {t("Reject")}
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {dialog?.type === "yard" ? (
        <YardDialog yard={dialog.yard} onClose={onClose} />
      ) : null}
      {dialog?.type === "event" ? (
        <EventDialog
          yards={data.yards}
          kind={dialog.kind}
          vin={dialog.vin}
          yardId={dialog.yardId}
          onClose={onClose}
        />
      ) : null}
      {dialog?.type === "inspection" ? (
        <InspectionDialog
          yards={data.yards}
          vin={dialog.vin}
          onClose={onClose}
        />
      ) : null}
      {dialog?.type === "release" ? (
        <ReleaseDialog yards={data.yards} vin={dialog.vin} onClose={onClose} />
      ) : null}
      {dialog?.type === "review" ? (
        <ReviewDialog id={dialog.id} status={dialog.status} onClose={onClose} />
      ) : null}
      {dialog?.type === "delete" ? (
        <DeleteYard yard={dialog.yard} onClose={onClose} />
      ) : null}
    </AppShell>
  );
}

function Section({
  action,
  empty,
  children,
}: {
  action?: ReactNode;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {action ? <div className="flex justify-end">{action}</div> : null}
      {empty ? <EmptyState title={empty} /> : <TableCard>{children}</TableCard>}
    </div>
  );
}

type Setter = (v: Record<string, string>) => void;
function useForm(initial: Record<string, string>) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<Record<string, string>>({});
  const bind = (key: string) => ({
    value: values[key] ?? "",
    onChange: (e: { target: { value: string } }) =>
      setValues({ ...values, [key]: e.target.value }),
  });
  return { values, bind, error, setError, setValues: setValues as Setter };
}

function YardSelect({
  yards,
  bind,
  optional,
  id,
}: {
  id?: string;
  yards: YardRow[];
  bind: { value: string; onChange: (e: { target: { value: string } }) => void };
  optional?: boolean;
}) {
  return (
    <NativeSelect id={id} {...bind}>
      <NativeSelectOption value="">
        {optional ? "-" : t("Choose a yard")}
      </NativeSelectOption>
      {yards.map((y) => (
        <NativeSelectOption key={y.id} value={y.id}>
          {y.code} · {y.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

const num = (v: string | undefined) =>
  v && v.trim() !== "" ? Number(v) : null;

function YardDialog({
  yard,
  onClose,
}: {
  yard: YardRow | null;
  onClose: () => void;
}) {
  const f = useForm({
    code: yard?.code ?? "",
    name: yard?.name ?? "",
    city: yard?.city ?? "",
    address: yard?.address ?? "",
    capacity: String(yard?.capacity ?? 100),
    status: yard?.status ?? "active",
  });
  const { run, pending } = useAction();
  return (
    <FormDialog
      title={yard ? "Edit yard" : "New yard"}
      submitLabel={t("Save yard")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const e: Record<string, string> = {};
        if (!f.values.code.trim()) e.code = "Enter a yard code";
        if (!f.values.name.trim()) e.name = "Enter the yard name";
        if (!(Number(f.values.capacity) >= 1))
          e.capacity = "Enter the capacity";
        f.setError(e);
        if (Object.keys(e).length) return;
        const done = await run(() =>
          saveYard({
            data: {
              ...f.values,
              id: yard?.id,
              capacity: Number(f.values.capacity),
              status: f.values.status as "active" | "closed",
            },
          }),
        );
        if (done) onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Code")} error={f.error.code}>
          <Input
            {...f.bind("code")}
            className="uppercase"
            placeholder="PS-01"
          />
        </Field>
        <Field label={t("Name")} error={f.error.name}>
          <Input {...f.bind("name")} />
        </Field>
        <Field label={t("City")}>
          <Input {...f.bind("city")} />
        </Field>
        <Field label={t("Capacity")} error={f.error.capacity}>
          <Input {...f.bind("capacity")} inputMode="numeric" />
        </Field>
        <Field label={t("Address")} className="sm:col-span-2">
          <Input {...f.bind("address")} />
        </Field>
        <Field label={t("Status")}>
          <NativeSelect {...f.bind("status")}>
            <NativeSelectOption value="active">
              {t("Active")}
            </NativeSelectOption>
            <NativeSelectOption value="closed">
              {t("Closed")}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
    </FormDialog>
  );
}

function EventDialog({
  yards,
  kind,
  vin,
  yardId,
  onClose,
}: {
  yards: YardRow[];
  kind: "entry" | "exit" | "move";
  vin?: string;
  yardId?: string;
  onClose: () => void;
}) {
  const f = useForm({
    yardId: yardId ?? "",
    vin: vin ?? "",
    zone: "",
    slot: "",
    gate: "",
    driverName: "",
    carrier: "",
    truckPlate: "",
    sealNumber: "",
    notes: "",
  });
  const { run, pending } = useAction();
  return (
    <FormDialog
      title={
        kind === "entry"
          ? "Gate entry"
          : kind === "exit"
            ? "Gate exit"
            : "Move vehicle"
      }
      submitLabel={t("Save")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const e: Record<string, string> = {};
        if (!f.values.yardId) e.yardId = "Choose a yard";
        if (f.values.vin.trim().length < 5) e.vin = "Enter the VIN";
        f.setError(e);
        if (Object.keys(e).length) return;
        const done = await run(() =>
          logYardEvent({ data: { ...f.values, kind } }),
        );
        if (done) onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Yard")} error={f.error.yardId}>
          <YardSelect
            yards={yards.filter((y) => y.status === "active")}
            bind={f.bind("yardId")}
          />
        </Field>
        <Field label="VIN" error={f.error.vin}>
          <Input
            {...f.bind("vin")}
            className="font-mono uppercase"
            maxLength={17}
            dir="ltr"
          />
        </Field>
        <Field label={t("Zone")}>
          <Input {...f.bind("zone")} placeholder="A" />
        </Field>
        <Field label={t("Slot")}>
          <Input {...f.bind("slot")} placeholder="12" />
        </Field>
        {kind !== "move" ? (
          <>
            <Field label={t("Gate")}>
              <Input {...f.bind("gate")} />
            </Field>
            <Field label={t("Driver")}>
              <Input {...f.bind("driverName")} />
            </Field>
            <Field label={t("Carrier")}>
              <Input {...f.bind("carrier")} />
            </Field>
            <Field label={t("Truck plate")}>
              <Input {...f.bind("truckPlate")} />
            </Field>
            <Field label={t("Seal")}>
              <Input {...f.bind("sealNumber")} />
            </Field>
          </>
        ) : null}
        <Field label={t("Notes")} className="sm:col-span-2">
          <Textarea {...f.bind("notes")} rows={2} />
        </Field>
      </div>
    </FormDialog>
  );
}

function InspectionDialog({
  yards,
  vin,
  onClose,
}: {
  yards: YardRow[];
  vin?: string;
  onClose: () => void;
}) {
  const f = useForm({
    yardId: "",
    vin: vin ?? "",
    stage: "gate_in",
    condition: "good",
    odometerKm: "",
    fuelPercent: "",
    damageNotes: "",
  });
  const { run, pending } = useAction();
  return (
    <FormDialog
      title="New inspection"
      submitLabel={t("Save inspection")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        if (f.values.vin.trim().length < 5)
          return f.setError({ vin: "Enter the VIN" });
        const v = f.values;
        const done = await run(() =>
          addInspection({
            data: {
              yardId: v.yardId || null,
              vin: v.vin,
              stage: v.stage as "gate_in",
              condition: v.condition as "good",
              odometerKm: num(v.odometerKm),
              fuelPercent: num(v.fuelPercent),
              damageNotes: v.damageNotes,
            },
          }),
        );
        if (done) onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="VIN" error={f.error.vin}>
          <Input
            {...f.bind("vin")}
            className="font-mono uppercase"
            maxLength={17}
            dir="ltr"
          />
        </Field>
        <Field label={t("Yard")}>
          <YardSelect yards={yards} bind={f.bind("yardId")} optional />
        </Field>
        <Field label={t("Stage")}>
          <NativeSelect {...f.bind("stage")}>
            {Object.entries(STAGE_LABEL).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {t(v)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("Condition")}>
          <NativeSelect {...f.bind("condition")}>
            {Object.entries(CONDITION_LABEL).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {t(v)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("Odometer (km)")}>
          <Input {...f.bind("odometerKm")} inputMode="numeric" />
        </Field>
        <Field label={t("Fuel %")}>
          <Input {...f.bind("fuelPercent")} inputMode="numeric" />
        </Field>
        <Field label={t("Damage notes")} className="sm:col-span-2">
          <Textarea {...f.bind("damageNotes")} rows={3} />
        </Field>
      </div>
    </FormDialog>
  );
}

function ReleaseDialog({
  yards,
  vin,
  onClose,
}: {
  yards: YardRow[];
  vin?: string;
  onClose: () => void;
}) {
  const f = useForm({
    yardId: "",
    vin: vin ?? "",
    customerName: "",
    recipientName: "",
    recipientId: "",
    recipientPhone: "",
    pickupDate: "",
  });
  const { run, pending } = useAction();
  return (
    <FormDialog
      title="Request release"
      submitLabel={t("Send request")}
      pending={pending}
      wide
      onClose={onClose}
      onSubmit={async () => {
        const e: Record<string, string> = {};
        if (f.values.vin.trim().length < 5) e.vin = "Enter the VIN";
        if (!f.values.recipientName.trim())
          e.recipientName = "Enter the recipient";
        f.setError(e);
        if (Object.keys(e).length) return;
        const done = await run(() =>
          requestRelease({
            data: { ...f.values, yardId: f.values.yardId || null },
          }),
        );
        if (done) onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="VIN" error={f.error.vin}>
          <Input
            {...f.bind("vin")}
            className="font-mono uppercase"
            maxLength={17}
            dir="ltr"
          />
        </Field>
        <Field label={t("Yard")}>
          <YardSelect yards={yards} bind={f.bind("yardId")} optional />
        </Field>
        <Field label={t("Customer")}>
          <Input {...f.bind("customerName")} />
        </Field>
        <Field label={t("Pickup date")}>
          <Input {...f.bind("pickupDate")} type="date" dir="ltr" />
        </Field>
        <Field label={t("Recipient")} error={f.error.recipientName}>
          <Input {...f.bind("recipientName")} />
        </Field>
        <Field label={t("Recipient ID number")}>
          <Input {...f.bind("recipientId")} />
        </Field>
        <Field label={t("Recipient phone")}>
          <Input {...f.bind("recipientPhone")} dir="ltr" />
        </Field>
      </div>
    </FormDialog>
  );
}

function ReviewDialog({
  id,
  status,
  onClose,
}: {
  id: string;
  status: "approved" | "rejected" | "released";
  onClose: () => void;
}) {
  const f = useForm({ reviewNotes: "" });
  const { run, pending } = useAction();
  return (
    <FormDialog
      title={status === "approved" ? "Approve release" : "Reject release"}
      submitLabel={t(status === "approved" ? "Approve" : "Reject")}
      pending={pending}
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(() =>
          reviewRelease({
            data: { id, status, reviewNotes: f.values.reviewNotes },
          }),
        );
        if (done) onClose();
      }}
    >
      <Field label={t("Notes")}>
        <Textarea {...f.bind("reviewNotes")} rows={3} />
      </Field>
    </FormDialog>
  );
}

function DeleteYard({ yard, onClose }: { yard: YardRow; onClose: () => void }) {
  const { run, pending } = useAction();
  return (
    <ConfirmDialog
      title={`Delete ${yard.name}?`}
      confirmLabel={t("Delete yard")}
      destructive
      pending={pending}
      onClose={onClose}
      onConfirm={async () => {
        await run(() => deleteYard({ data: { id: yard.id } }));
        onClose();
      }}
    >
      {t("Its gate log is deleted too.")}
    </ConfirmDialog>
  );
}
