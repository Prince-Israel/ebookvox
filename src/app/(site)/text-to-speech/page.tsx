import type { Metadata } from "next";
import { ToolLanding, type ToolCopy } from "@/components/seo/ToolLanding";

const copy: ToolCopy = {
  path: "/text-to-speech",
  h1: "Free text to speech online: turn any text into natural speech",
  lead: "Paste your text and hear it read aloud in natural voices, including Nigerian, British, African and American accents. Try a free sample below, then create a free account to listen to whole documents, with your place saved.",
  sample: "Welcome to Ebookvox. Paste any text here, choose a voice, and listen. It's a simple way to proofread an essay, study on the move, or enjoy an article without staring at the screen.",
  cta: "Create a free account",
  steps: [
    ["Paste or upload", "Type or paste text, or upload a PDF, Word (DOCX) or TXT file."],
    ["Choose a voice", "Pick from 30+ natural voices and set the speed you like."],
    ["Listen anywhere", "Press play. Keep listening with the screen off, and pick up where you stopped."],
  ],
  faq: [
    ["Is Ebookvox text to speech free?", "You can try a free sample on this page without an account. A free account lets you listen to whole texts and files; free listeners watch one short video before the voice starts, or you can go ad-free from $1.80 a month."],
    ["What voices can I choose?", "More than 30 natural voices: Nigerian, South African, East African, British, American and more, in male and female tones, so the reading suits you."],
    ["Can I download the audio?", "Yes. With a free account you can download the audio of your text or file as an MP3 and listen offline."],
    ["How long can my text be?", "The sample here is up to 400 characters. With an account you can read long texts and whole documents."],
    ["Does it work on my phone?", "Yes. It works in your phone's browser, and there is an Android app on Google Play. On iPhone you can add it to your Home Screen."],
  ],
};

export const metadata: Metadata = {
  title: { absolute: "Free text to speech online: natural voices, no download | Ebookvox" },
  description: "Turn any text into natural speech online. Try a free sample with Nigerian, British, African and American voices, then listen to whole documents and download the audio.",
  alternates: { canonical: "/text-to-speech" },
};

export default function TextToSpeech() { return <ToolLanding copy={copy} />; }
