import { db } from "@/lib/db";
import { ApiError, clientIp, rateLimit, readJson, route } from "@/lib/api";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import { normalizePhone, signUpSchema } from "@/lib/validation";
import { currencyForCountry } from "@/lib/countries";
import { sendVerification } from "@/lib/account";
import { notify } from "@/lib/notify";
import { emitEvent } from "@/lib/events";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 3600_000);
  const d = signUpSchema.parse(await readJson(req));
  if (await db.user.findUnique({ where: { email: d.email } }))
    throw new ApiError(409, "A publisher account with this email already exists. Try signing in.", { email: "This email is already registered." });
  const user = await db.user.create({
    data: {
      emailVerifiedAt: !process.env.SMTP_HOST && process.env.DEV_AUTO_VERIFY === "true" ? new Date() : null, email: d.email, firstName: d.firstName, lastName: d.lastName, publisherName: `${d.firstName} ${d.lastName}`.trim(),
      passwordHash: await hashPassword(d.password), country: d.country, currency: currencyForCountry(d.country),
      phoneCountry: d.phoneCountry, phone: normalizePhone(d.phone, d.phoneCountry),
    },
  });
  await emitEvent("publisher.created", { id: user.id, name: user.publisherName, email: user.email, country: user.country });
  await sendVerification(user);
  await notify(user.id, "ACCOUNT_UPDATE", "Welcome to Ebookvox Publisher", "Verify your email to start uploading and selling your books.", "/profile");
  await createSession(user.id);
  return { user: publicUser(user) };
});
