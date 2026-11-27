import type { FormEvent, ReactNode } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { t } from "@/lib/i18n";

/** A dialog around a form: fields, then Cancel and the submit button. */
export function FormDialog({
  title,
  submitLabel,
  pending,
  onSubmit,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  submitLabel: string;
  pending?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className={wide ? "sm:max-w-xl" : "sm:max-w-md"}>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(title)}</DialogTitle>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" pending={pending}>
              {t(submitLabel)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
