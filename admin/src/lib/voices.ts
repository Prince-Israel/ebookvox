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
