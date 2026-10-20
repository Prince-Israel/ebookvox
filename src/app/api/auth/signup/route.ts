import { voiceForCountry } from "@/lib/voices";
import { db } from "@/lib/db";
import { ApiError, clientIp, rateLimit, readJson, route } from "@/lib/api";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import { normalizePhone, signUpSchema } from "@/lib/validation";
import { currencyForCountry } from "@/lib/countries";
import { sendVerification, welcome } from "@/lib/account";
import { emitEvent } from "@/lib/events";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 3600_000);
  const d = signUpSchema.parse(await readJson(req));
  if (await db.user.findUnique({ where: { email: d.email } }))
    throw new ApiError(409, "An account with this email already exists. Try signing in.", { email: "This email is already registered." });
  const platformVoice = (await db.platformConfig.findUnique({ where: { key: "defaultVoice" } }))?.value ?? undefined;
  const user = await db.user.create({
    data: {
      email: d.email,
      termsAcceptedAt: new Date(),
      emailVerifiedAt: !process.env.SMTP_HOST && process.env.DEV_AUTO_VERIFY === "true" ? new Date() : null, 
      firstName: d.firstName,
      lastName: d.lastName,
      passwordHash: await hashPassword(d.password),
      country: d.country,
      currency: currencyForCountry(d.country),
      phoneCountry: d.phoneCountry,
      phone: normalizePhone(d.phone, d.phoneCountry),
      defaultVoice: voiceForCountry(d.country, platformVoice),
    },
  });
  await emitEvent("user.created", { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, country: user.country });
  await sendVerification(user);
  await welcome(user.id, user.firstName);
  await createSession(user.id, req.headers.get("user-agent"));
  return { user: publicUser(user) };
});
