import { useId, type ReactElement, type ReactNode } from "react";
import { cloneElement } from "react";
import { Label } from "@/client/components/ui/label";
import { t } from "@/lib/i18n";

/** A label, its control and the control's inline error. */
export function Field({
  label,
  error,
  className,
  children,
}: {
  label: ReactNode;
  error?: string;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{typeof label === "string" ? t(label) : label}</Label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
