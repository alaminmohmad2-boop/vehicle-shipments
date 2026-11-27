import { Link, useRouter } from "@tanstack/react-router";
import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button, buttonVariants } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { fileKind, formatBytes, formatDate } from "@/client/lib/format";
import { Section } from "./Section";
import type { BookingData } from "./types";
import { t } from "@/lib/i18n";

type Attachment = BookingData["attachments"][number];
const MAX = 20 * 1024 * 1024;

export function DocumentsSection({ data }: { data: BookingData }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const [pending, setPending] = useState(false);
  const bookingId = data.booking.id;

  async function upload(file: File) {
    if (file.size > MAX) return toast.error(t("Files can be up to 20 MB"));
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/bookings/${bookingId}/attachments`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const answer = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(t(answer?.error ?? "The upload failed"));
      }
      await router.invalidate();
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(attachment: Attachment) {
    setPending(true);
    const response = await fetch(`/api/attachments/${attachment.id}`, {
      method: "DELETE",
    });
    if (!response.ok) toast.error(await response.text());
    await router.invalidate();
    setPending(false);
    setDeleting(null);
  }

  return (
    <Section
      title={t("Documents")}
      actions={
        <>
          <Link
            to="/bookings/$id/bill-of-lading"
            params={{ id: bookingId }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText data-icon="inline-start" />
            {t("Bill of lading")}
          </Link>
          <Button
            variant="outline"
            size="sm"
            pending={uploading}
            onClick={() => input.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {t("Upload file")}
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            data-testid="attachment-input"
            accept="application/pdf,image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </>
      }
    >
      {data.attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("No files yet. Upload PDFs or images up to 20 MB.")}
        </p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Type")}</TableHead>
                <TableHead className="text-end">{t("Size")}</TableHead>
                <TableHead>{t("Uploaded by")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attachments.map((attachment) => (
                <TableRow key={attachment.id} data-testid="attachment-row">
                  <TableCell className="max-w-56 truncate">
                    {attachment.name}
                  </TableCell>
                  <TableCell>{fileKind(attachment.contentType)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatBytes(attachment.size)}
                  </TableCell>
                  <TableCell>{attachment.uploader ?? ""}</TableCell>
                  <TableCell>{formatDate(attachment.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        {t("Download")}
                      </a>
                      {attachment.canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(attachment)}
                        >
                          {t("Delete")}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel={t("Delete file")}
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() => void remove(deleting)}
        />
      ) : null}
    </Section>
  );
}
