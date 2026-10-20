/** The Privacy Policy and Terms live on the Reader site. Set READER_PUBLIC_URL if READER_URL is an internal address. */
export const readerPublicUrl = () => (process.env.READER_PUBLIC_URL ?? process.env.READER_URL ?? "http://localhost:3230").replace(/\/$/, "");
