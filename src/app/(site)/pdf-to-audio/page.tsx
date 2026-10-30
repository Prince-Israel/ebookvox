import type { Metadata } from "next";
import { ToolLanding, type ToolCopy } from "@/components/seo/ToolLanding";

const copy: ToolCopy = {
  path: "/pdf-to-audio",
  h1: "PDF to audio: listen to any PDF, Word file or document",
  lead: "Turn a PDF, Word document (DOCX) or text file into audio you can listen to anywhere. Try how it sounds with a free sample below, then upload your file with a free account.",
  sample: "Chapter one. The report begins with a short summary of the main findings, followed by the details behind each recommendation. Listening makes long documents easier to get through.",
  cta: "Upload your PDF free",
  steps: [
    ["Upload your file", "Add a PDF, DOCX or TXT file up to 15 MB. We extract the text for you."],
    ["Pick a voice", "Choose from 30+ natural voices and your reading speed."],
    ["Listen or download", "Listen in the app, or download the audio as an MP3 for later."],
  ],
  faq: [
    ["How do I convert a PDF to audio?", "Create a free account, upload your PDF, choose a voice and press play. You can also download the finished audio as an MP3."],
    ["Which files can I upload?", "PDF, Word (DOCX) and plain text (TXT) files up to 15 MB. Scanned PDFs that are only pictures of text can't be read, because there is no text to extract."],
    ["Is it free?", "Yes to start: a free account can upload files and listen. Free listeners watch one short video first. Subscribe from $1.80 a month to remove ads and videos."],
    ["Can I listen to a PDF while I do other things?", "Yes. The audio keeps playing with the screen off in the Android app and in your phone's browser."],
    ["Can I choose a Nigerian or African voice?", "Yes. There are Nigerian, South African and East African English voices, as well as British and American ones."],
  ],
};

export const metadata: Metadata = {
  title: { absolute: "PDF to audio: listen to any PDF or document free | Ebookvox" },
  description: "Convert a PDF, Word or text file to audio you can listen to anywhere. Try a free sample, choose from 30+ natural voices, and download the MP3.",
  alternates: { canonical: "/pdf-to-audio" },
};

export default function PdfToAudio() { return <ToolLanding copy={copy} />; }
