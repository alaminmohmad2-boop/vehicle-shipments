import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import * as yard from "@/server/yard";

export const getYardOverview = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => ({
    ...(await yard.getYardOverview(context.user)),
    canAdmin: isAdmin(context.user),
  }));

export const saveYard = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => yard.yardInput.parse(data))
  .handler(({ data, context }) => yard.saveYard(context.user, data));

export const deleteYard = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data, context }) => yard.deleteYard(context.user, data.id));

export const logYardEvent = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => yard.eventInput.parse(data))
  .handler(({ data, context }) => yard.logEvent(context.user, data));

export const addInspection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => yard.inspectionInput.parse(data))
  .handler(({ data, context }) => yard.addInspection(context.user, data));

export const requestRelease = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => yard.releaseInput.parse(data))
  .handler(({ data, context }) => yard.requestRelease(context.user, data));

export const reviewRelease = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => yard.reviewInput.parse(data))
  .handler(({ data, context }) => yard.reviewRelease(context.user, data));
