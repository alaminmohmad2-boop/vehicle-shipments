import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { exportCsv, type ExportKind } from "@/server/reports";

const KINDS = ["bookings", "vehicles", "invoices", "customers"] as const;

// Download a CSV (opens in Excel). Private: the Gateway signs the member in and
// the file holds only what that member may see.
export const Route = createFileRoute("/api/export/$kind")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { kind: string };
      }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (!(KINDS as readonly string[]).includes(params.kind))
          return new Response("Not found", { status: 404 });
        const csv = await exportCsv(user, params.kind as ExportKind);
        return new Response(csv, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="${params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
