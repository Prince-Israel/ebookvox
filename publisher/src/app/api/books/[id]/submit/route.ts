import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { bookInclude, serializeBook, submissionProblems } from "@/lib/books";
import { notify, notifyAdmins } from "@/lib/notify";
import { emitEvent } from "@/lib/events";

/** Draft/Rejected → Reviewing. There is no other way for a book to reach the Reader. */
export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  const b = await db.book.findFirst({ where: { id: (await params).id, publisherId: u.id }, include: bookInclude });
  if (!b) throw new ApiError(404, "We couldn't find that book.");
  if (!["DRAFT", "REJECTED"].includes(b.status)) throw new ApiError(409, "This book has already been submitted.");
  const problems = submissionProblems(serializeBook(b));
  if (Object.keys(problems).length) throw new ApiError(422, `Complete the book before submitting: ${Object.values(problems)[0]}`, problems);
  const resubmit = b.status === "REJECTED";
  await db.book.update({ where: { id: b.id }, data: { status: "REVIEWING", submittedAt: new Date(), rejectionReason: null } });
  await notify(u.id, "BOOK_SUBMITTED", resubmit ? "Book resubmitted" : "Book submitted for review", `“${b.title}” is now in the Admin review queue.`, `/books/${b.id}`);
  await emitEvent("book.submitted", { id: b.id, title: b.title, author: b.author, publisher: u.publisherName, resubmit });
  await notifyAdmins("REVIEW_QUEUE", "New book to review", `“${b.title}” by ${b.author} (${u.publisherName})`, "/admin/review");
});
