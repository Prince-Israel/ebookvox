import { NextRequest } from "next/server";
import { getUser } from "./auth";
import { countryOf } from "./geo";
import { currencyForCountry } from "./countries";

/**
 * Who is looking, and the currency to price in: always the currency of where they are right now, so a traveller
 * is shown (and charged) local prices. Falls back to the account currency only when the location can't be worked out.
 */
export async function viewer(req: NextRequest) {
  const user = await getUser();
  const country = await countryOf(req);
  const currency = country ? currencyForCountry(country) : user?.currency ?? currencyForCountry(null);
  return { user, currency, country };
}
