import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { publicUser, requireUser } from "@/lib/auth";
import { countrySchema, normalizePhone } from "@/lib/validation";
import { currencyForCountry } from "@/lib/countries";
import { notify } from "@/lib/notify";

export const GET = route(async () => ({ user: publicUser(await requireUser()) }));

const patchSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  publisherName: z.string().trim().min(2, "Publisher name is required.").max(120),
  bio: z.string().trim().max(1500, "Biography is too long (1,500 characters max)."),
  country: countrySchema,
  phoneCountry: countrySchema,
  phone: z.string().trim(),
  theme: z.enum(["light", "dark", "system"]),
}).partial();

export const PATCH = route(async (req) => {
  const u = await requireUser();
  const d = patchSchema.parse(await readJson(req));
  const data: Record<string, unknown> = { ...d };
  delete data.phone; delete data.phoneCountry;
  if (d.country && d.country !== u.country) {
    // The primary currency follows the country, but only before any money has moved: wallets are per currency.
    data.currency = currencyForCountry(d.country);
  }
  if (d.phone !== undefined || d.phoneCountry !== undefined) {
    const pc = d.phoneCountry ?? u.phoneCountry;
    try { data.phone = normalizePhone(d.phone ?? "", pc); data.phoneCountry = pc; }
    catch (e) { return Response.json({ error: (e as Error).message, fields: { phone: (e as Error).message } }, { status: 400 }); }
  }
  const updated = await db.user.update({ where: { id: u.id }, data });
  if (Object.keys(d).some((k) => k !== "theme")) await notify(u.id, "ACCOUNT_UPDATE", "Profile updated", "Your publisher profile was saved.", "/profile");
  return { user: publicUser(updated) };
});
