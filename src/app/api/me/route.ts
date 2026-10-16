import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { publicUser, requireUser } from "@/lib/auth";
import { countrySchema, normalizePhone } from "@/lib/validation";
import { currencyForCountry } from "@/lib/countries";
import { resolveVoice, SPEEDS } from "@/lib/voices";
import { notify } from "@/lib/notify";

export const GET = route(async () => ({ user: publicUser(await requireUser()) }));

const patchSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(60),
    lastName: z.string().trim().min(1, "Last name is required.").max(60),
    country: countrySchema,
    phoneCountry: countrySchema,
    phone: z.string().trim(),
    defaultVoice: z.string().refine((v) => resolveVoice(v).id === v, "Unknown voice."),
    defaultSpeed: z.number().refine((n) => (SPEEDS as readonly number[]).includes(n), "Unsupported speed."),
    autoPlay: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
    notifyPurchase: z.boolean(),
    notifyBooks: z.boolean(),
    notifySupport: z.boolean(),
  })
  .partial();

export const PATCH = route(async (req) => {
  const u = await requireUser();
  const d = patchSchema.parse(await readJson(req));
  const data: Record<string, unknown> = { ...d };
  delete data.phone;
  delete data.phoneCountry;
  if (d.country) data.currency = currencyForCountry(d.country);
  if (d.defaultVoice) data.voiceChosen = true; // from now on their own choice wins over the country default
  if (d.phone !== undefined || d.phoneCountry !== undefined) {
    const pc = d.phoneCountry ?? u.phoneCountry ?? d.country ?? u.country;
    const raw = d.phone ?? "";
    if (raw === "") {
      data.phone = null;
      data.phoneCountry = pc;
    } else {
      try {
        data.phone = normalizePhone(raw, pc);
      } catch (e) {
        return Response.json({ error: (e as Error).message, fields: { phone: (e as Error).message } }, { status: 400 });
      }
      data.phoneCountry = pc;
    }
  }
  const updated = await db.user.update({ where: { id: u.id }, data });
  if (d.firstName || d.lastName || d.country || d.phone !== undefined)
    await notify(u.id, "ACCOUNT_UPDATE", "Profile updated", "Your account details were saved.", "/profile");
  return { user: publicUser(updated) };
});
