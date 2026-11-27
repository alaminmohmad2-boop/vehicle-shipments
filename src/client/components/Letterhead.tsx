import { t } from "@/lib/i18n";
import type { Company } from "@/server/settings";

/** Logo and company details at the top of a printed document. */
export function Letterhead({ company }: { company: Company }) {
  const placeholder = !company.name && !company.logo;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
      <div className="space-y-0.5 text-sm">
        <div className="text-lg font-semibold">
          {company.name || t("Your company name")}
        </div>
        {company.address ? (
          <div className="whitespace-pre-wrap text-muted-foreground">
            {company.address}
          </div>
        ) : null}
        <div className="text-muted-foreground">
          {[company.phone, company.email].filter(Boolean).join(" · ")}
        </div>
        {company.taxId ? (
          <div className="text-muted-foreground">{company.taxId}</div>
        ) : null}
      </div>
      {company.logo ? (
        <img
          src={company.logo}
          alt=""
          className="h-16 max-w-48 object-contain"
        />
      ) : placeholder ? (
        <div className="flex h-16 w-32 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          {t("Your logo")}
        </div>
      ) : null}
    </div>
  );
}
