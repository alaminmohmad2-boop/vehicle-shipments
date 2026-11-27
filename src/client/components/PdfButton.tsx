import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * Saves the element with this id as an A4 PDF, rendered by the browser, so
 * Arabic (right to left) and the logo come out exactly as on screen.
 * The libraries load only when the button is pressed.
 */
export function PdfButton({
  targetId,
  fileName,
}: {
  targetId: string;
  fileName: string;
}) {
  const [pending, setPending] = useState(false);
  async function save() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setPending(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          doc.documentElement.classList.remove("dark");
          const el = doc.getElementById(targetId);
          if (el) {
            el.style.background = "#ffffff";
            el.style.color = "#111111";
            el.style.padding = "24px";
          }
        },
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 10;
      const width = 210 - margin * 2;
      const pageHeight = 297 - margin * 2;
      const scale = width / canvas.width; // mm per canvas pixel
      const sliceHeight = Math.floor(pageHeight / scale);
      for (let y = 0, page = 0; y < canvas.height; y += sliceHeight, page++) {
        const part = document.createElement("canvas");
        part.width = canvas.width;
        part.height = Math.min(sliceHeight, canvas.height - y);
        part
          .getContext("2d")!
          .drawImage(
            canvas,
            0,
            y,
            canvas.width,
            part.height,
            0,
            0,
            canvas.width,
            part.height,
          );
        if (page > 0) pdf.addPage();
        pdf.addImage(
          part.toDataURL("image/jpeg", 0.92),
          "JPEG",
          margin,
          margin,
          width,
          part.height * scale,
        );
      }
      pdf.save(`${fileName}.pdf`);
    } catch {
      toast.error(t("Could not create the PDF"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Button
      variant="outline"
      className="print:hidden"
      pending={pending}
      onClick={save}
    >
      <FileDown data-icon="inline-start" />
      {t("Download PDF")}
    </Button>
  );
}
