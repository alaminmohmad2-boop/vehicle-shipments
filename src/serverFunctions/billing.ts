import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import * as billing from "@/server/billing";

const byId = z.object({ id: z.string().uuid() });

export const getTariffs = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => ({
    tariffs: await billing.listTariffs(context.user),
    canEdit: isAdmin(context.user),
  }));

export const saveTariff = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => billing.tariffInput.parse(data))
  .handler(({ data, context }) => billing.saveTariff(context.user, data));

export const deleteTariff = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(({ data, context }) => billing.deleteTariff(context.user, data.id));

export const applyTariffs = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => billing.applyTariffsInput.parse(data))
  .handler(({ data, context }) => billing.applyTariffs(context.user, data));

export const addCharge = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => billing.chargeInput.parse(data))
  .handler(({ data, context }) => billing.addCharge(context.user, data));

export const removeCharge = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => billing.chargeRef.parse(data))
  .handler(({ data, context }) => billing.removeCharge(context.user, data));

export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => billing.issueInvoiceInput.parse(data))
  .handler(({ data, context }) => billing.issueInvoice(context.user, data));

export const markPaid = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(({ data, context }) => billing.markPaid(context.user, data.id));

export const voidInvoice = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(({ data, context }) => billing.voidInvoice(context.user, data.id));

export const getInvoiceDocument = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(({ data, context }) =>
    billing.getInvoiceDocument(context.user, data.id),
  );
