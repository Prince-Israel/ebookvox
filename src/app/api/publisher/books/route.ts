import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, readJson, route } from "@/lib/api";
import { approveBook, bookInput, upsertBook } from "@/lib/books";

function checkKey(req: NextRequest) {
  const expected = process.env.PUBLISHER_API_KEY;
  const got = req.headers.get("x-publisher-key") ?? "";
  const ok = !!expected && got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) throw new ApiError(401, "Invalid publisher API key.");
}

/**
 * Ingestion endpoint for the Publisher platform (server-to-server).
 * Books arrive as PENDING and become visible in the Reader once an admin approves them.
 */
export const POST = route(async (req) => {
  checkKey(req);
  const body = (await readJson(req)) as { approved?: boolean };
  const input = bookInput.parse(body);
  const { book, created } = await upsertBook(input);
  // `approved` is only honoured because this endpoint is key-protected: the Publisher platform sets it solely after its own admin approval.
  if (body.approved === true) await approveBook(book.id);
  return Response.json({ id: book.id, status: body.approved === true ? "APPROVED" : book.status, created }, { status: created ? 201 : 200 });
}, { skipOrigin: true });

export const GET = route(async (req) => {
  checkKey(req);
  const { db } = await import("@/lib/db");
  const externalId = req.nextUrl.searchParams.get("externalId");
  const books = await db.book.findMany({ where: externalId ? { externalId } : {}, select: { id: true, externalId: true, title: true, status: true, rejectionReason: true, approvedAt: true }, take: 200 });
  return { books };
}, { skipOrigin: true });
