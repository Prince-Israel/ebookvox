/** The blog posts. Plain data: add a post by adding an object here (newest first). In text, [label](/path) makes a link and **word** makes bold. */
export type Block =
  | { h: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string };

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  readMins: number;
  tag: string;
  intro: string;
  body: Block[];
  faq?: Array<[string, string]>;
  /** Book titles (starts of titles) to show as "free right now" cards under the post. */
  showBooks?: string[];
  cta?: { text: string; href: string; label: string };
};

export const POSTS: Post[] = [
  {
    slug: "how-to-turn-a-pdf-into-audio",
    title: "How to turn a PDF into audio (free, in four steps)",
    description: "Listen to any PDF, Word file or text document instead of reading it. A step-by-step guide to converting a PDF to audio, with tips for the best result.",
    date: "2026-10-30",
    readMins: 5,
    tag: "How-to",
    intro: "Long reports, lecture notes and e-books are easier to get through when you can listen to them while you walk, cook or travel. Here is how to turn a PDF into audio with Ebookvox, what works best, and what doesn't.",
    body: [
      { h: "Why listen to a PDF?" },
      { p: "Reading a long PDF on a small screen is tiring, and it needs your eyes and hands. Listening frees both. People use it to get through study notes, work reports, research papers and e-books, and to catch mistakes in their own writing, because errors that slip past your eyes are easy to hear." },
      { h: "What you need" },
      { ul: ["A PDF, Word (DOCX) or plain text (TXT) file, up to 15 MB.", "A free Ebookvox account (you can try a sample first on the [PDF to audio page](/pdf-to-audio)).", "A phone, tablet or computer with a browser, or the Android app."] },
      { h: "The four steps" },
      { ol: [
        "**Create a free account.** It takes a minute with your email, or with Google. [Create your account](/sign-up?next=/home).",
        "**Upload your file.** On the Home page, choose the Upload tab and pick your PDF, DOCX or TXT file. Ebookvox pulls the text out of it for you.",
        "**Choose a voice and speed.** Pick from more than 30 voices, including Nigerian, South African, East African, British and American accents, and set the speed that suits you, from 0.5x to 2x.",
        "**Listen, or download.** Press play. Free listeners watch one short video first; the audio then starts. You can also download the finished audio as an MP3 and listen offline.",
      ] },
      { h: "Tips for a better result" },
      { ul: [
        "**Use a text-based PDF.** If you can select and copy the words in your PDF, it will work well. A scanned PDF that is only a picture of text has no text to read, so Ebookvox can't turn it into audio. Run it through an OCR tool first, or use the original document.",
        "**Clean up first if you can.** Page numbers and repeating headers can be read out loud between paragraphs. Removing them makes the listening smoother.",
        "**Start with a short test.** Listen to the first page before you commit to a 200-page document, and try a couple of voices.",
        "**Use headings.** Clear headings help you find your place, and tapping any paragraph on screen starts the audio from there.",
      ] },
      { h: "Listening on your phone" },
      { p: "In the browser, audio keeps playing when you switch to another app on most phones. On Android, the [Ebookvox app on Google Play](https://play.google.com/store/apps/details?id=app.ebookvox.reader) keeps reading with the screen off. On iPhone, open Ebookvox in Safari and use Share, then Add to Home Screen, to get an app-like icon." },
      { note: "Only upload files you have the right to use. Ebookvox processes your document to produce the audio for you and does not share it." },
    ],
    faq: [
      ["Is it really free?", "A free account can upload files and listen. Free listeners watch one short video before the voice starts. Going ad-free costs from $1.80 a month and removes the videos."],
      ["Can I convert a scanned PDF?", "Not directly. A scan is only an image, so there is no text to read. Use OCR software to turn it into a text PDF first."],
      ["Can I download the audio?", "Yes. With an account you can download the audio of your document as an MP3."],
    ],
    cta: { text: "Try how it sounds first: a free sample, no account needed.", href: "/pdf-to-audio", label: "Try the PDF to audio sample" },
  },
  {
    slug: "best-free-classic-audiobooks",
    title: "Classic books you can listen to today: a beginner's list",
    description: "Pride and Prejudice, Frankenstein, Sherlock Holmes and more: great classic books worth listening to, and how to start for free.",
    date: "2026-10-30",
    readMins: 6,
    tag: "Reading lists",
    intro: "Classic books are some of the best listening there is: strong stories, memorable characters, and many are old enough to be in the public domain. Here are eight to start with, and how to listen to them on Ebookvox.",
    body: [
      { h: "Why classics make good listening" },
      { p: "A classic has lasted because the story holds you. That matters when you are listening, because you can't skim. Many classics are also written to be read aloud: dialogue-heavy, with clear scenes and strong endings to each chapter." },
      { h: "Eight to try first" },
      { ul: [
        "**Pride and Prejudice** by Jane Austen (1813). A sparkling comedy about love, money and first impressions. Funny, warm and easy to follow.",
        "**Frankenstein** by Mary Shelley (1818). A young scientist creates life and then runs from what he has made. Short chapters, big ideas.",
        "**Alice's Adventures in Wonderland** by Lewis Carroll (1865). Nonsense, riddles and a rabbit hole. A good first choice if you are new to listening.",
        "**The Adventures of Sherlock Holmes** by Arthur Conan Doyle (1892). Twelve self-contained cases, perfect for short journeys.",
        "**The Time Machine** by H. G. Wells (1895). A Victorian inventor travels far into the future. Short and gripping.",
        "**Dracula** by Bram Stoker (1897). Told through letters and diaries, which suits listening well.",
        "**Treasure Island** by Robert Louis Stevenson (1883). Pirates, a treasure map and Long John Silver.",
        "**The Art of War** by Sun Tzu. Ancient advice on strategy, in short sections you can take one at a time.",
      ] },
      { h: "How to listen on Ebookvox" },
      { ol: [
        "Open the book from the list below, or browse [all the classics](/category/classic-fiction).",
        "Press Read Now. Free titles open right away (free listeners watch one short video before the voice starts).",
        "Pick a voice you enjoy. A calm, steady voice suits long novels; try a few in the first chapter.",
        "Set the speed. Many people like 1.25x for familiar stories.",
      ] },
      { note: "Some titles on Ebookvox are free and some are paid. The page of each book shows its price, so check the label before you open it." },
      { h: "A tip for your first book" },
      { p: "Pick something short, with chapters you can finish in one sitting. Sherlock Holmes or Alice are good starts. Once you have your rhythm, move on to a longer novel." },
    ],
    showBooks: ["Pride and Prejudice", "Alice's Adventures in Wonderland", "The Adventures of Sherlock Holmes", "Frankenstein", "The Time Machine", "The Art of War", "Dracula", "Treasure Island"],
    faq: [
      ["Are these books really free?", "Many classics are in the public domain, and Ebookvox offers a large number of them free. Some titles are paid. The price is shown on each book's page."],
      ["Which classic should I listen to first?", "Alice's Adventures in Wonderland or a single Sherlock Holmes story are short, fun and easy to follow."],
    ],
    cta: { text: "Browse free and paid books in every category.", href: "/books", label: "Browse the books" },
  },
  {
    slug: "listen-to-ebooks-while-commuting",
    title: "How to listen to ebooks while commuting (or doing anything else)",
    description: "Turn travel time and chores into reading time. Practical tips for listening to books and documents on your phone: voices, speed, data and battery.",
    date: "2026-10-30",
    readMins: 5,
    tag: "Tips",
    intro: "Most of us spend hours a week travelling, cooking or cleaning with our hands busy and our minds free. Listening to books turns that time into reading time. Here is how to set it up so it just works.",
    body: [
      { h: "Pick the right book for the journey" },
      { p: "Match the book to the trip. For a 20-minute ride, choose something in short chapters, like a story collection. For longer trips, a novel you already know a little about is easier to follow with half your attention." },
      { h: "Choose a voice you can listen to for an hour" },
      { p: "The voice matters more than you expect. Ebookvox has more than 30, in Nigerian, South African, East African, British and American accents. Try three in the first chapter and keep the one that you stop noticing, which means it is easy to listen to." },
      { h: "Find your speed" },
      { p: "Speeds run from 0.5x to 2x. Most people settle around 1.25x to 1.5x. Slow down for dense or technical text, speed up for stories you know well." },
      { h: "Set up your phone" },
      { ul: [
        "**Android:** install the [Ebookvox app](https://play.google.com/store/apps/details?id=app.ebookvox.reader). It keeps reading with the screen off and shows controls on the lock screen.",
        "**iPhone:** open Ebookvox in Safari, tap Share, then Add to Home Screen. It opens like an app.",
        "**Headphones:** use ones you are comfortable wearing for a while, and keep one ear free in traffic.",
      ] },
      { h: "Data and battery" },
      { p: "Books are read to you passage by passage over the internet, so you need a connection while you listen. A good habit is to start the book before you leave, while you are on Wi-Fi. For your own documents, you can download the audio as an MP3 and listen with no connection at all." },
      { h: "Pick up where you stopped" },
      { p: "Ebookvox remembers your place. Open the app and the Home page shows a Continue where you stopped card with your progress, so you are back in the story in one tap." },
    ],
    faq: [
      ["Does it work with the screen off?", "In the Android app, yes. In a phone's browser it depends on the phone and browser, which is why the app is the best choice for long listening."],
      ["Can I listen without internet?", "Books stream over the internet. For your own text or files you can download the audio as an MP3 and play it anywhere."],
    ],
    cta: { text: "Get the Android app, or try the free sample online.", href: "/text-to-speech", label: "Try the free sample" },
  },
  {
    slug: "text-to-speech-for-students",
    title: "Text to speech for students: study smarter by listening",
    description: "How students can use text to speech to revise notes, proofread essays and get through set texts. Practical study tips with a free tool.",
    date: "2026-10-30",
    readMins: 5,
    tag: "Study tips",
    intro: "Reading the same notes for the fifth time doesn't help much. Listening to them, while you walk to class, do chores or rest your eyes, gives your memory a second way in. Here is how students can use text to speech well.",
    body: [
      { h: "Listen to your notes" },
      { p: "Type or paste your notes into Ebookvox, or upload them as a PDF or Word file, and listen. Hearing a topic explained back to you, at a speed you choose, is a different kind of revision from rereading, and it fills the time you would not otherwise study." },
      { h: "Proofread by ear" },
      { p: "When you read your own essay, your brain fills in what you meant. When you hear it, awkward sentences and missing words stand out. Paste your draft in, listen once, and mark the places where you stumble." },
      { h: "Get through set texts" },
      { p: "Long set books and readings are easier with two channels: reading with your eyes while the voice reads aloud. Tap any paragraph on screen to start the audio from that exact point, so you can follow along and catch up." },
      { h: "Study habits that work" },
      { ul: [
        "**Listen, then recall.** Pause after a section and say what you heard in your own words.",
        "**Slow down for hard material.** Use 0.75x for dense topics and 1.5x for review.",
        "**Pick an accent you find easy.** There are Nigerian, South African, East African, British and American voices.",
        "**Little and often.** Ten minutes on the bus every day beats one long session before the exam.",
      ] },
      { h: "A fair-use reminder" },
      { p: "Only upload material you have the right to use, such as your own notes or documents you have permission to use. Listening should add to reading your set books, not replace the parts your teacher expects you to read closely." },
    ],
    faq: [
      ["Can I upload lecture notes as a PDF?", "Yes. Upload a PDF, Word or text file up to 15 MB. Text-based PDFs work best; scanned images of pages can't be read."],
      ["Is it free for students?", "You can try a free sample without an account. A free account lets you listen to full documents; free listeners watch one short video first, and ad-free costs from $1.80 a month."],
    ],
    cta: { text: "Paste a paragraph of your notes and hear it now.", href: "/text-to-speech", label: "Try the free sample" },
  },
  {
    slug: "ebooks-audiobooks-text-to-speech",
    title: "Ebooks, audiobooks and text to speech: what is the difference?",
    description: "Ebooks, audiobooks and text-to-speech reading explained in plain words, with what each is good for and how Ebookvox combines reading and listening.",
    date: "2026-10-30",
    readMins: 5,
    tag: "Explained",
    intro: "These three words get mixed up. They are three different ways to take in a book, and they work best together. Here is what each one means and when to use it.",
    body: [
      { h: "Ebooks: reading on a screen" },
      { p: "An ebook is a book as text on a screen. You can change the text size, search it and carry thousands of them. It needs your eyes, so it is best for focused reading." },
      { h: "Audiobooks: a person reads to you" },
      { p: "A traditional audiobook is a recording of a narrator reading the book. The performance can be excellent, but recording a book takes a studio and time, so far fewer books exist as audiobooks than as text, and they usually cost more." },
      { h: "Text to speech: a computer voice reads the text" },
      { p: "Text to speech turns written text into spoken audio at once. Modern voices are natural enough to listen to for hours, and because it works on any text, it can read books that never had a recorded version, and your own documents too." },
      { h: "Which should you use?" },
      { ul: [
        "**Reading with your eyes** for careful study, poetry and anything you want to reread.",
        "**A recorded audiobook** when you want a performance and the title is available.",
        "**Text to speech** when you want to listen to anything: a classic with no recording, your notes, a report, a PDF.",
      ] },
      { h: "How Ebookvox fits in" },
      { p: "Ebookvox lets you do both at once. Open a book, read it on screen, and press play to hear it in one of more than 30 voices, with the line you are on highlighted. Your place is saved, so you can read on the sofa and keep listening on the bus. And because it works on any text, you can also upload your own documents." },
      { note: "The voices on Ebookvox are computer-generated, not recorded human narrators." },
    ],
    faq: [
      ["Is text to speech as good as a human narrator?", "Modern voices are natural and pleasant to listen to, but a human narrator can add acting and emotion. Text to speech wins on choice: it can read almost any text."],
      ["Can I read and listen at the same time?", "Yes. On Ebookvox the text is shown while the voice reads, and tapping a paragraph starts the audio from there."],
    ],
    cta: { text: "Hear how a computer voice reads, free, no account needed.", href: "/text-to-speech", label: "Try the free sample" },
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug) ?? null;
