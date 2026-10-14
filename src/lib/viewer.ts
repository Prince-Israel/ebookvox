import { NextRequest } from "next/server";
import { getUser } from "./auth";
import { countryOf } from "./geo";
import { currencyForCountry } from "./countries";

/** Signed-in user, or an anonymous visitor priced in the currency of their country. */
export async function viewer(req: NextRequest) {
  const user = await getUser();
  if (user) return { user, currency: user.currency };
  const country = await countryOf(req);
  return { user: null, currency: currencyForCountry(country) };
}
