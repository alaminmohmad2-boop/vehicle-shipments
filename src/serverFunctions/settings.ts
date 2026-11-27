import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import * as settings from "@/server/settings";

export const getCompany = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => ({
    company: await settings.getCompany(context.user),
    canEdit: isAdmin(context.user),
  }));

export const saveCompany = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => settings.settingsInput.parse(data))
  .handler(({ data, context }) => settings.saveCompany(context.user, data));
