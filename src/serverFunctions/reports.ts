import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as reports from "@/server/reports";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => reports.getDashboard(context.user));

export const getCustomerReport = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => reports.getCustomerReport(context.user));
