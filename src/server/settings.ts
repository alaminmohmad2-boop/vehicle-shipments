import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { requireAdmin, type Viewer } from "./access";

export const settingsInput = z.object({
  name: z.string().trim().max(120),
  address: z.string().trim().max(400),
  phone: z.string().trim().max(60),
  email: z.string().trim().max(120),
  taxId: z.string().trim().max(60),
  /** Basis points; 1000 = 10%. */
  defaultTaxBps: z.number().int().min(0).max(10000).default(0),
  /** Empty removes the logo. */
  logo: z
    .string()
    .max(280_000, "The logo is too large (200 KB at most)")
    .regex(
      /^(data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+)?$/,
      "The logo must be a PNG, JPEG or SVG image",
    ),
});

export type Company = z.output<typeof settingsInput>;

const empty: Company = {
  name: "",
  address: "",
  phone: "",
  email: "",
  taxId: "",
  defaultTaxBps: 0,
  logo: "",
};

export async function getCompany(user: Viewer): Promise<Company> {
  const [row] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.orgId, user.orgId));
  if (!row) return empty;
  const { orgId: _o, updatedAt: _u, ...rest } = row;
  return rest;
}

export async function saveCompany(user: Viewer, input: Company) {
  requireAdmin(user);
  await db
    .insert(companySettings)
    .values({ orgId: user.orgId, ...input })
    .onConflictDoUpdate({ target: companySettings.orgId, set: input });
  return { ok: true };
}
