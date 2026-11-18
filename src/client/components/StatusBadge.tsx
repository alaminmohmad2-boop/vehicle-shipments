import { Badge } from "@/client/components/ui/badge";
import { statusLabel } from "@/lib/shipping";

const VARIANTS: Record<
  string,
  "soft" | "success" | "outline" | "destructive" | "info"
> = {
  booked: "outline",
  loaded: "info",
  arrived: "info",
  delivered: "success",
  cancelled: "destructive",
};

export function StatusBadge({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  return (
    <Badge variant={VARIANTS[status] ?? "soft"} data-testid={testId}>
      {statusLabel(status)}
    </Badge>
  );
}
