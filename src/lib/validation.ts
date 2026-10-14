import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { isCountry } from "./countries";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Password needs a lowercase letter.")
  .regex(/[A-Z]/, "Password needs an uppercase letter.")
  .regex(/[0-9]/, "Password needs a number.");

const nameSchema = (label: string) => z.string().trim().min(1, `${label} is required.`).max(60, `${label} is too long.`);

export const countrySchema = z.string().refine(isCountry, "Select a valid country.");

/** Digits only, validated against the chosen dialing country; returns E.164. */
export function normalizePhone(national: string, dialCountry: string): string {
  if (!/^[0-9\s]*$/.test(national)) throw new Error("Phone number can only contain digits.");
  const digits = national.replace(/\s/g, "");
  if (!digits) throw new Error("Phone number is required.");
  const p = parsePhoneNumberFromString(digits, dialCountry as CountryCode);
  if (!p || !p.isPossible()) throw new Error("Enter a valid phone number for the selected country.");
  return p.number;
}

export const phoneFields = z.object({ phoneCountry: countrySchema, phone: z.string().trim() }).transform((v, ctx) => {
  try {
    return { phoneCountry: v.phoneCountry, phone: normalizePhone(v.phone, v.phoneCountry) };
  } catch (e) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: (e as Error).message });
    return z.NEVER;
  }
});

export const signUpSchema = z
  .object({
    firstName: nameSchema("First name"),
    lastName: nameSchema("Last name"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    country: countrySchema,
    phoneCountry: countrySchema,
    phone: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    try {
      normalizePhone(v.phone, v.phoneCountry);
    } catch (e) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: (e as Error).message });
    }
  });
