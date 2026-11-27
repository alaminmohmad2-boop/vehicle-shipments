import { Printer } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { t } from "@/lib/i18n";

/** Opens the browser's print dialog, where the page can also be saved as a PDF. */
export function PrintButton() {
  return (
    <Button
      variant="outline"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer data-icon="inline-start" />
      {t("Print")}
    </Button>
  );
}
