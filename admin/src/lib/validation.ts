import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128).regex(/[a-z]/, "Add a lowercase letter.").regex(/[A-Z]/, "Add an uppercase letter.").regex(/[0-9]/, "Add a number.");
export const phoneSchema = z.string().trim().regex(/^\+?[0-9\s-]{6,20}$/, "Enter a valid phone number (digits, optional +).").optional().or(z.literal(""));
