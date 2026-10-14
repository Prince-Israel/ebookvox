# Free book catalogue

`prisma/seed-catalog.ts` fills the Reader with free, English-language, public-domain books from
[Project Gutenberg](https://www.gutenberg.org), each with its cover image (Gutenberg's cover for that edition) and credited to its author.
About a fifth are spiritual titles (sermons, devotionals, theology, Bible commentary).

```bash
npx tsx prisma/seed-catalog.ts --target 1500   # add up to 1,500 new books (default)
npx tsx prisma/seed-catalog.ts --target 5000   # as many as you like — needs ~375 MB of database per 1,000 books
npx tsx prisma/seed-catalog.ts --recategorize  # re-apply the category rules to books already added
```

- Safe to re-run: books already in the catalogue are skipped.
- Authors are capped (3 per author, more for sermon collections) so the catalogue spans many writers and eras.
- "Free" here means public domain: no copyright remains, so nobody is owed a royalty. These are not books an author is
  giving away personally. For living authors and pastors who want to offer a title free, publish it through the Publisher platform with the
  *Free* option.
- Covers are fetched from Gutenberg by the Reader and cached in `data/cover-cache/` (git-ignored).
