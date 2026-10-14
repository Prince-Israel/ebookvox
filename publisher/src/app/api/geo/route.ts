import { route } from "@/lib/api";
import { countryOf } from "@/lib/geo";
import { currencyForCountry, listCountries } from "@/lib/countries";

/** Public: where is this visitor? Used to default the country, phone code and currency. */
export const GET = route(async (req) => {
  const country = await countryOf(req);
  const c = country ? listCountries().find((x) => x.code === country) : null;
  return { country, dial: c?.dial ?? null, currency: country ? currencyForCountry(country) : null };
});
