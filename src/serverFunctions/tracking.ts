import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getTracking } from "@/server/tracking";

// The public tracking page's data. No middleware: anyone with the token may
// read it, and getTracking returns only what that page shows.
export const getPublicTracking = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ token: z.string().max(100) }).parse(data),
  )
  .handler(({ data }) => getTracking(data.token));
