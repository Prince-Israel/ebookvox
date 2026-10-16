// Voice catalogue. Every entry maps to a *different* neural voice (id = Microsoft
// neural voice short-name, supported by both Azure Speech and the keyless Edge
// provider), so selecting another voice always produces different audio.
// `rate`/`pitch` add a style signature on top (e.g. Documentary is slower/lower).

export type VoiceGroup = "African" | "International" | "Narrator";

export type Voice = {
  id: string;
  name: string;
  group: VoiceGroup;
  accent: string;
  style: string;
  gender: "Female" | "Male";
  description: string;
  rate: number; // percent offset, -50..+50
  pitch: number; // percent offset
};

const v = (
  id: string, name: string, group: VoiceGroup, accent: string, style: string,
  gender: "Female" | "Male", description: string, rate = 0, pitch = 0,
): Voice => ({ id, name, group, accent, style, gender, description, rate, pitch });

export const VOICES: Voice[] = [
  // ---- African ----
  v("en-NG-EzinneNeural", "Ezinne", "African", "Nigerian English", "Warm Female", "Female", "Warm, friendly Nigerian woman — a natural all-round reader."),
  v("en-NG-AbeoNeural", "Abeo", "African", "Nigerian English", "Professional", "Male", "Clear, steady Nigerian man for articles and reports.", 0, -2),
  v("en-ZA-LeahNeural", "Leah", "African", "South African English", "Calm", "Female", "Smooth and calm; relaxed pacing for long reading sessions.", -6, 0),
  v("en-ZA-LukeNeural", "Luke", "African", "South African English", "Deep Male", "Male", "Grounded, resonant male voice.", -4, -6),
  v("en-KE-AsiliaNeural", "Asilia", "African", "East African English (Kenya)", "Energetic", "Female", "Bright, lively East African voice.", 6, 2),
  v("en-KE-ChilembaNeural", "Chilemba", "African", "East African English (Kenya)", "Documentary", "Male", "Measured East African narrator for non-fiction.", -6, -3),
  v("en-TZ-ImaniNeural", "Imani", "African", "East African English (Tanzania)", "Young Adult", "Female", "Youthful and upbeat Tanzanian voice.", 4, 3),
  v("en-TZ-ElimuNeural", "Elimu", "African", "East African English (Tanzania)", "Baritone", "Male", "Rich, mellow baritone.", -8, -8),
  // ---- International ----
  v("en-GB-SoniaNeural", "Sonia", "International", "British English", "Warm Female", "Female", "Polished British woman — classic audiobook warmth."),
  v("en-GB-RyanNeural", "Ryan", "International", "British English", "Professional", "Male", "Confident British newsreader tone."),
  v("en-GB-LibbyNeural", "Libby", "International", "British English", "Young Adult", "Female", "Fresh, youthful British voice.", 4, 2),
  v("en-GB-ThomasNeural", "Thomas", "International", "British English", "Storyteller", "Male", "Gentle British storyteller.", -10, -2),
  v("en-GB-MaisieNeural", "Maisie", "International", "British English", "Energetic", "Female", "Playful, high-energy British voice.", 8, 4),
  v("en-US-JennyNeural", "Jenny", "International", "American English", "Warm Female", "Female", "Friendly and comforting American voice."),
  v("en-US-GuyNeural", "Guy", "International", "American English", "Energetic", "Male", "Passionate, expressive American voice.", 6, 0),
  v("en-US-AriaNeural", "Aria", "International", "American English", "Professional", "Female", "Confident, articulate American voice."),
  v("en-US-ChristopherNeural", "Christopher", "International", "American English", "Documentary", "Male", "Authoritative documentary narrator.", -8, -4),
  v("en-AU-NatashaNeural", "Natasha", "International", "Australian English", "Warm Female", "Female", "Friendly Australian woman."),
  v("en-AU-WilliamMultilingualNeural", "William", "International", "Australian English", "Calm", "Male", "Relaxed Australian man.", -6, -2),
  v("en-CA-ClaraNeural", "Clara", "International", "Canadian English", "Calm", "Female", "Soft, even Canadian voice.", -6, 0),
  v("en-CA-LiamNeural", "Liam", "International", "Canadian English", "Professional", "Male", "Neutral, clear Canadian voice."),
  v("en-IE-EmilyNeural", "Emily", "International", "Irish English", "Storyteller", "Female", "Lilting Irish storyteller.", -8, 0),
  v("en-IE-ConnorNeural", "Connor", "International", "Irish English", "Warm Male", "Male", "Warm, conversational Irish man.", 0, 0),
  v("en-IN-NeerjaNeural", "Neerja", "International", "Indian English", "Professional", "Female", "Clear Indian English voice.", 0, 0),
  v("en-IN-PrabhatNeural", "Prabhat", "International", "Indian English", "Calm", "Male", "Calm, measured Indian English voice.", -4, 0),
  v("en-NZ-MollyNeural", "Molly", "International", "New Zealand English", "Young Adult", "Female", "Bright New Zealand voice.", 4, 2),
  v("en-NZ-MitchellNeural", "Mitchell", "International", "New Zealand English", "Warm Male", "Male", "Easygoing New Zealand man."),
  // ---- Narrator styles (distinct US voices tuned for a style) ----
  v("en-US-AndrewNeural", "Andrew", "Narrator", "American English", "Deep Male", "Male", "Warm, confident deep male narrator.", -4, -8),
  v("en-US-BrianNeural", "Brian", "Narrator", "American English", "Baritone", "Male", "Smooth, casual baritone.", -6, -6),
  v("en-US-EmmaNeural", "Emma", "Narrator", "American English", "Storyteller", "Female", "Cheerful, clear storytelling voice.", -6, 0),
  v("en-US-AvaNeural", "Ava", "Narrator", "American English", "Calm", "Female", "Expressive, caring and unhurried.", -8, 0),
  v("en-US-RogerNeural", "Roger", "Narrator", "American English", "Documentary", "Male", "Lively mature voice for explanatory content.", -2, -2),
  v("en-US-MichelleNeural", "Michelle", "Narrator", "American English", "Young Adult", "Female", "Pleasant, youthful American voice.", 2, 2),
];

export function resolveVoice(id: string): Voice {
  return VOICES.find((x) => x.id === id) ?? VOICES[0];
}

export const DEFAULT_VOICE = VOICES[0].id;
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

// ---- Default voice by country ----------------------------------------------------------------------------------
// A voice that matches the listener's own country when we have one; otherwise the closest general voice for their region.
const COUNTRY_VOICE: Record<string, string> = {
  NG: "en-NG-EzinneNeural", ZA: "en-ZA-LeahNeural", KE: "en-KE-AsiliaNeural", TZ: "en-TZ-ImaniNeural",
  GB: "en-GB-SoniaNeural", IE: "en-IE-EmilyNeural", US: "en-US-JennyNeural", CA: "en-CA-ClaraNeural",
  AU: "en-AU-NatashaNeural", NZ: "en-NZ-MollyNeural", IN: "en-IN-NeerjaNeural",
};
const set = (s: string) => new Set(s.split(" "));
// Africa: no voice of their own → the nearest African voice (West/Central → Nigerian, East → Kenyan, Southern → South African, North → Kenyan).
const AFRICA_WEST_CENTRAL = set("GH SL LR GM GN GW SN ML BF NE TG BJ CI CV MR CM TD GA GQ CG CD CF ST");
const AFRICA_EAST = set("UG RW BI ET SO SS ER DJ SD MG MU SC KM");
const AFRICA_SOUTH = set("ZW BW NA ZM MZ LS SZ MW AO");
const AFRICA_NORTH = set("EG LY TN DZ MA EH");
const EUROPE = set("AL AD AM AT AZ BY BE BA BG HR CY CZ DK EE FI FR GE DE GR HU IS IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA VA GI GG JE IM FO AX");
const SOUTH_ASIA = set("PK BD LK NP BT MV AF");
const ASIA = set("CN JP KR KP TW HK MO MN TH VN LA KH MM MY SG ID PH BN TL KZ UZ TM KG TJ AE SA QA KW BH OM YE IQ IR IL JO LB SY TR PS");
const OCEANIA = set("FJ PG WS TO VU SB KI FM MH PW NR TV CK NU");
const AMERICAS = set("MX GT BZ HN SV NI CR PA CU JM HT DO PR BS BB TT GD LC VC AG DM KN CO VE GY SR EC PE BR BO PY UY AR CL GL BM KY");

/** The voice to use before the user has chosen one: matched to their country, else their region's general voice. */
export function voiceForCountry(code?: string | null, fallback: string = DEFAULT_VOICE): string {
  const c = (code ?? "").toUpperCase();
  if (COUNTRY_VOICE[c]) return COUNTRY_VOICE[c];
  if (AFRICA_WEST_CENTRAL.has(c)) return COUNTRY_VOICE.NG;
  if (AFRICA_EAST.has(c) || AFRICA_NORTH.has(c)) return COUNTRY_VOICE.KE;
  if (AFRICA_SOUTH.has(c)) return COUNTRY_VOICE.ZA;
  if (EUROPE.has(c)) return COUNTRY_VOICE.GB; // general European English
  if (SOUTH_ASIA.has(c) || ASIA.has(c)) return COUNTRY_VOICE.IN; // general Asian English
  if (OCEANIA.has(c)) return COUNTRY_VOICE.AU;
  if (AMERICAS.has(c)) return COUNTRY_VOICE.US; // general American English
  return fallback; // a country we can't place: whatever the platform's default voice is
}
