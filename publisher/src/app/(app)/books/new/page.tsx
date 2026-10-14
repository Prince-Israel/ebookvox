import { PageTitle } from "@/components/ui";
import { BookForm } from "@/components/BookForm";

export default function NewBook() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Upload a book" sub="Save it as a draft, or submit it straight to our review team." />
      <BookForm />
    </div>
  );
}
