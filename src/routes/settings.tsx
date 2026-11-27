import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/hooks/useAction";
import { getCompany, saveCompany } from "@/serverFunctions/settings";
import { t } from "@/lib/i18n";
import { parsePercent } from "@/lib/shipping";

export const Route = createFileRoute("/settings")({
  loader: () => getCompany(),
  head: () => ({ meta: [{ title: "Company · Vehicle Shipments" }] }),
  component: Settings,
});

function Settings() {
  const { company, canEdit } = Route.useLoaderData();
  const [values, setValues] = useState(company);
  const [tax, setTax] = useState(
    String(Number((company.defaultTaxBps / 100).toFixed(2))),
  );
  const { run, pending } = useAction();
  const bind = (key: Exclude<keyof typeof values, "defaultTaxBps">) => ({
    value: values[key],
    disabled: !canEdit,
    onChange: (e: { target: { value: string } }) =>
      setValues({ ...values, [key]: e.target.value }),
  });
  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 200 * 1024)
      return toast.error(t("The logo is too large (200 KB at most)"));
    const reader = new FileReader();
    reader.onload = () => setValues({ ...values, logo: String(reader.result) });
    reader.readAsDataURL(file);
  }
  return (
    <AppShell>
      <PageHeader
        title={t("Company")}
        description={t("Shown at the top of invoices and bills of lading.")}
      />
      <div className="space-y-4">
        <Field label={t("Company name")}>
          <Input {...bind("name")} />
        </Field>
        <Field label={t("Address")}>
          <Textarea {...bind("address")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Phone")}>
            <Input {...bind("phone")} />
          </Field>
          <Field label={t("Email")}>
            <Input {...bind("email")} />
          </Field>
        </div>
        <Field label={t("Tax number")}>
          <Input {...bind("taxId")} />
        </Field>
        <Field
          label={t("Default tax percent")}
          error={
            parsePercent(tax) === null
              ? t("Enter a percentage from 0 to 100")
              : undefined
          }
        >
          <Input
            value={tax}
            disabled={!canEdit}
            inputMode="decimal"
            onChange={(e) => setTax(e.target.value)}
          />
        </Field>
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("Logo")}</div>
          {values.logo ? (
            <img
              src={values.logo}
              alt=""
              className="h-16 max-w-48 object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("No logo yet")}</p>
          )}
          {canEdit ? (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => pickLogo(e.target.files?.[0])}
                className="text-sm"
              />
              {values.logo ? (
                <Button
                  variant="outline"
                  onClick={() => setValues({ ...values, logo: "" })}
                >
                  {t("Remove logo")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            pending={pending}
            onClick={async () => {
              const bps = parsePercent(tax);
              if (bps === null) return;
              const done = await run(() =>
                saveCompany({ data: { ...values, defaultTaxBps: bps } }),
              );
              if (done) toast.success(t("Saved"));
            }}
          >
            {t("Save")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("Only owners and admins can change this.")}
          </p>
        )}
      </div>
    </AppShell>
  );
}
