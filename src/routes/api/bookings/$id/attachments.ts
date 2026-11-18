import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { MAX_BYTES, uploadAttachment } from "@/server/attachments";

// Upload a file to a booking (multipart, field "file"). Private: the Gateway
// signs the member in; the booking must be one they may open.
export const Route = createFileRoute("/api/bookings/$id/attachments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_BYTES + 64 * 1024) {
          return Response.json(
            { error: "Files can be up to 20 MB" },
            { status: 413 },
          );
        }
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        const result = await uploadAttachment(
          user,
          params.id,
          file instanceof File ? file : null,
        );
        return Response.json(result, { status: result.status });
      },
    },
  },
});
